/**
 * useKeyboardShortcuts Hook
 *
 * Global keyboard shortcuts for mode switching and common actions.
 * Handles Cmd/Ctrl+1,2,3 for Chat/Agent/Visual modes.
 *
 * Features:
 * - Global keyboard shortcut handling
 * - Mode switching (Cmd+1 Chat, Cmd+2 Agent, Cmd+3 Visual)
 * - Conflict prevention with text input fields
 * - Platform-aware modifier keys (Cmd on Mac, Ctrl on Windows/Linux)
 * - Customizable shortcut bindings
 * - Focus trap awareness
 *
 * Feature #7: Chat Mode System - Keyboard shortcuts for mode switching
 */

import { useEffect, useCallback, useRef } from "react";
import { getModeManager, type OperationalMode } from "@/lib/agent-bridge/mode-manager";

// =============================================================================
// Types
// =============================================================================

/** Keyboard shortcut definition */
export interface ShortcutDefinition {
  /** Unique key identifier */
  key: string;
  /** Key code or key name */
  code: string;
  /** Require meta key (Cmd on Mac, Ctrl on Windows) */
  meta?: boolean;
  /** Require Ctrl key specifically */
  ctrl?: boolean;
  /** Require Shift key */
  shift?: boolean;
  /** Require Alt/Option key */
  alt?: boolean;
  /** Handler function */
  handler: (event: KeyboardEvent) => void;
  /** Description for help text */
  description: string;
  /** Category for grouping */
  category?: string;
  /** Whether shortcut is enabled */
  enabled?: boolean;
}

/** Shortcut options */
export interface ShortcutOptions {
  /** Enable mode switching shortcuts */
  enableModeShortcuts?: boolean;
  /** Custom shortcut handlers */
  customShortcuts?: ShortcutDefinition[];
  /** Callback when mode changes */
  onModeChange?: (mode: OperationalMode) => void;
  /** Elements to ignore (selectors) */
  ignoreElements?: string[];
  /** Enable/disable all shortcuts */
  enabled?: boolean;
}

/** Platform info */
export interface PlatformInfo {
  isMac: boolean;
  modifierKey: "meta" | "ctrl";
  modifierSymbol: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Default elements to ignore shortcuts in */
const DEFAULT_IGNORE_ELEMENTS = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[contenteditable=true]",
  ".monaco-editor",
  ".CodeMirror",
  ".cm-editor",
];

/** Mode shortcut key mappings */
const MODE_SHORTCUTS: Record<string, OperationalMode> = {
  "1": "chat",
  "2": "agent",
  "3": "visual",
};

/** Shortcut display info for modes */
export const MODE_SHORTCUT_INFO: Record<OperationalMode, { key: string; display: string }> = {
  chat: { key: "1", display: "⌘1" },
  agent: { key: "2", display: "⌘2" },
  visual: { key: "3", display: "⌘3" },
};

// =============================================================================
// Utilities
// =============================================================================

/**
 * Detect platform and return modifier key info
 */
export function getPlatformInfo(): PlatformInfo {
  if (typeof navigator === "undefined") {
    return { isMac: false, modifierKey: "ctrl", modifierSymbol: "Ctrl" };
  }

  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  return {
    isMac,
    modifierKey: isMac ? "meta" : "ctrl",
    modifierSymbol: isMac ? "⌘" : "Ctrl",
  };
}

/**
 * Check if the event target is an input element where shortcuts should be ignored
 */
function shouldIgnoreShortcut(
  event: KeyboardEvent,
  ignoreSelectors: string[]
): boolean {
  const target = event.target as HTMLElement;

  if (!target) return false;

  // Check if target matches any ignore selector
  for (const selector of ignoreSelectors) {
    if (target.matches(selector)) {
      return true;
    }
    // Also check if target is inside an ignored element
    if (target.closest(selector)) {
      return true;
    }
  }

  // Check for input-like elements by tag name
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    // Allow shortcuts for specific input types that don't accept text
    const inputType = (target as HTMLInputElement).type?.toLowerCase();
    const nonTextInputs = ["button", "submit", "reset", "checkbox", "radio", "file", "image"];
    if (!nonTextInputs.includes(inputType)) {
      return true;
    }
  }

  // Check for contenteditable
  if (target.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Check if the modifier key matches the current platform
 */
function checkModifierKey(event: KeyboardEvent, platformInfo: PlatformInfo): boolean {
  if (platformInfo.isMac) {
    return event.metaKey && !event.ctrlKey;
  }
  return event.ctrlKey && !event.metaKey;
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: ShortcutDefinition): string {
  const platform = getPlatformInfo();
  const parts: string[] = [];

  if (shortcut.meta) {
    parts.push(platform.modifierSymbol);
  }
  if (shortcut.ctrl) {
    parts.push("Ctrl");
  }
  if (shortcut.shift) {
    parts.push(platform.isMac ? "⇧" : "Shift");
  }
  if (shortcut.alt) {
    parts.push(platform.isMac ? "⌥" : "Alt");
  }

  parts.push(shortcut.code.toUpperCase());

  return parts.join(platform.isMac ? "" : "+");
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Global keyboard shortcuts hook
 *
 * @example
 * ```tsx
 * // Basic usage with mode switching
 * useKeyboardShortcuts({
 *   enableModeShortcuts: true,
 *   onModeChange: (mode) => console.log(`Mode: ${mode}`),
 * });
 *
 * // With custom shortcuts
 * useKeyboardShortcuts({
 *   enableModeShortcuts: true,
 *   customShortcuts: [
 *     {
 *       key: "save",
 *       code: "s",
 *       meta: true,
 *       handler: () => saveDocument(),
 *       description: "Save document",
 *     },
 *   ],
 * });
 * ```
 */
export function useKeyboardShortcuts(options: ShortcutOptions = {}) {
  const {
    enableModeShortcuts = true,
    customShortcuts = [],
    onModeChange,
    ignoreElements = DEFAULT_IGNORE_ELEMENTS,
    enabled = true,
  } = options;

  const platformInfo = useRef(getPlatformInfo());
  const modeManager = useRef(getModeManager());

  /**
   * Switch to a different mode
   */
  const switchMode = useCallback(
    (mode: OperationalMode) => {
      const manager = modeManager.current;
      const currentMode = manager.getMode();

      if (mode === currentMode) return;

      const success = manager.setMode(mode);
      if (success) {
        onModeChange?.(mode);
      }
    },
    [onModeChange]
  );

  /**
   * Handle mode switching shortcuts
   */
  const handleModeShortcut = useCallback(
    (event: KeyboardEvent): boolean => {
      if (!enableModeShortcuts) return false;

      // Check for Cmd/Ctrl + number (1, 2, 3)
      if (!checkModifierKey(event, platformInfo.current)) return false;
      if (event.shiftKey || event.altKey) return false;

      const targetMode = MODE_SHORTCUTS[event.key];
      if (targetMode) {
        event.preventDefault();
        event.stopPropagation();
        switchMode(targetMode);
        return true;
      }

      return false;
    },
    [enableModeShortcuts, switchMode]
  );

  /**
   * Handle custom shortcuts
   */
  const handleCustomShortcuts = useCallback(
    (event: KeyboardEvent): boolean => {
      for (const shortcut of customShortcuts) {
        if (shortcut.enabled === false) continue;

        // Check key match
        if (event.key.toLowerCase() !== shortcut.code.toLowerCase()) continue;

        // Check modifier keys
        const platform = platformInfo.current;

        if (shortcut.meta) {
          if (!checkModifierKey(event, platform)) continue;
        }

        if (shortcut.ctrl && !event.ctrlKey) continue;
        if (shortcut.shift && !event.shiftKey) continue;
        if (shortcut.alt && !event.altKey) continue;

        // Execute handler
        event.preventDefault();
        event.stopPropagation();
        shortcut.handler(event);
        return true;
      }

      return false;
    },
    [customShortcuts]
  );

  /**
   * Main keydown handler
   */
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if in text input
      if (shouldIgnoreShortcut(event, ignoreElements)) {
        return;
      }

      // Try mode shortcuts first
      if (handleModeShortcut(event)) return;

      // Try custom shortcuts
      if (handleCustomShortcuts(event)) return;
    };

    // Add listener with capture phase to catch events early
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [enabled, ignoreElements, handleModeShortcut, handleCustomShortcuts]);

  return {
    switchMode,
    platformInfo: platformInfo.current,
    getModeShortcut: (mode: OperationalMode) => MODE_SHORTCUT_INFO[mode],
  };
}

// =============================================================================
// Provider Component (Optional)
// =============================================================================

/**
 * Get all registered shortcuts for help display
 */
export function getAllShortcuts(customShortcuts: ShortcutDefinition[] = []): ShortcutDefinition[] {
  const platform = getPlatformInfo();

  // Mode shortcuts
  const modeShortcuts: ShortcutDefinition[] = [
    {
      key: "mode-chat",
      code: "1",
      meta: true,
      handler: () => {},
      description: "Switch to Chat mode",
      category: "Mode Switching",
    },
    {
      key: "mode-agent",
      code: "2",
      meta: true,
      handler: () => {},
      description: "Switch to Agent mode",
      category: "Mode Switching",
    },
    {
      key: "mode-visual",
      code: "3",
      meta: true,
      handler: () => {},
      description: "Switch to Visual mode",
      category: "Mode Switching",
    },
  ];

  return [...modeShortcuts, ...customShortcuts];
}

/**
 * Shortcut help text generator
 */
export function getShortcutHelpText(): string {
  const platform = getPlatformInfo();
  const mod = platform.modifierSymbol;

  return `
Mode Switching:
  ${mod}1  Switch to Chat mode
  ${mod}2  Switch to Agent mode
  ${mod}3  Switch to Visual mode
`.trim();
}

export default useKeyboardShortcuts;
