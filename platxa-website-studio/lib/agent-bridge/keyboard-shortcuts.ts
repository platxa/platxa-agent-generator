/**
 * Keyboard Shortcuts for Panel Navigation
 *
 * Implements keyboard shortcuts for navigating between panels.
 * Cmd+1 focuses chat, Cmd+2 focuses preview, Cmd+3 focuses editor.
 */

// ============================================================================
// Types
// ============================================================================

export interface KeyboardShortcut {
  readonly id: string;
  readonly key: string;
  readonly modifiers: readonly Modifier[];
  readonly action: string;
  readonly description: string;
  readonly category: ShortcutCategory;
  readonly enabled: boolean;
  readonly global: boolean;
}

export type Modifier = 'cmd' | 'ctrl' | 'alt' | 'shift' | 'meta';
export type ShortcutCategory = 'navigation' | 'editing' | 'view' | 'general' | 'custom';

export interface Panel {
  readonly id: string;
  readonly name: string;
  readonly shortcutKey: string;
  readonly focused: boolean;
  readonly visible: boolean;
  readonly order: number;
}

export interface KeyboardShortcutsState {
  readonly shortcuts: Map<string, KeyboardShortcut>;
  readonly panels: Map<string, Panel>;
  readonly focusedPanelId: string | null;
  readonly enabled: boolean;
  readonly useMetaKey: boolean; // true for Mac (Cmd), false for Windows/Linux (Ctrl)
}

export interface ShortcutEvent {
  readonly shortcutId: string;
  readonly action: string;
  readonly key: string;
  readonly modifiers: readonly Modifier[];
  readonly timestamp: number;
  readonly prevented: boolean;
}

export type ShortcutHandler = (event: ShortcutEvent) => void;

export interface KeyEvent {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

export interface FocusChangeEvent {
  readonly previousPanelId: string | null;
  readonly newPanelId: string;
  readonly panelName: string;
  readonly timestamp: number;
}

export type FocusChangeHandler = (event: FocusChangeEvent) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PANELS: readonly Panel[] = [
  { id: 'chat', name: 'Chat', shortcutKey: '1', focused: false, visible: true, order: 1 },
  { id: 'preview', name: 'Preview', shortcutKey: '2', focused: false, visible: true, order: 2 },
  { id: 'editor', name: 'Editor', shortcutKey: '3', focused: false, visible: true, order: 3 },
];

const DEFAULT_SHORTCUTS: readonly KeyboardShortcut[] = [
  {
    id: 'focus-chat',
    key: '1',
    modifiers: ['cmd'],
    action: 'focus_panel',
    description: 'Focus chat panel',
    category: 'navigation',
    enabled: true,
    global: true,
  },
  {
    id: 'focus-preview',
    key: '2',
    modifiers: ['cmd'],
    action: 'focus_panel',
    description: 'Focus preview panel',
    category: 'navigation',
    enabled: true,
    global: true,
  },
  {
    id: 'focus-editor',
    key: '3',
    modifiers: ['cmd'],
    action: 'focus_panel',
    description: 'Focus editor panel',
    category: 'navigation',
    enabled: true,
    global: true,
  },
  {
    id: 'next-panel',
    key: ']',
    modifiers: ['cmd'],
    action: 'next_panel',
    description: 'Focus next panel',
    category: 'navigation',
    enabled: true,
    global: true,
  },
  {
    id: 'prev-panel',
    key: '[',
    modifiers: ['cmd'],
    action: 'prev_panel',
    description: 'Focus previous panel',
    category: 'navigation',
    enabled: true,
    global: true,
  },
  {
    id: 'toggle-preview',
    key: 'p',
    modifiers: ['cmd', 'shift'],
    action: 'toggle_preview',
    description: 'Toggle preview panel',
    category: 'view',
    enabled: true,
    global: true,
  },
  {
    id: 'toggle-editor',
    key: 'e',
    modifiers: ['cmd', 'shift'],
    action: 'toggle_editor',
    description: 'Toggle editor panel',
    category: 'view',
    enabled: true,
    global: true,
  },
  {
    id: 'escape',
    key: 'Escape',
    modifiers: [],
    action: 'blur_panel',
    description: 'Blur current panel',
    category: 'general',
    enabled: true,
    global: false,
  },
];

// ============================================================================
// State
// ============================================================================

let state: KeyboardShortcutsState = {
  shortcuts: new Map(DEFAULT_SHORTCUTS.map(s => [s.id, s])),
  panels: new Map(DEFAULT_PANELS.map(p => [p.id, p])),
  focusedPanelId: null,
  enabled: true,
  useMetaKey: true, // Default to Mac
};

let shortcutHandlers: ShortcutHandler[] = [];
let focusHandlers: FocusChangeHandler[] = [];

// ============================================================================
// Panel Management
// ============================================================================

export function getPanel(id: string): Panel | null {
  return state.panels.get(id) ?? null;
}

export function getAllPanels(): readonly Panel[] {
  return Array.from(state.panels.values()).sort((a, b) => a.order - b.order);
}

export function getVisiblePanels(): readonly Panel[] {
  return getAllPanels().filter(p => p.visible);
}

export function getFocusedPanel(): Panel | null {
  if (!state.focusedPanelId) {
    return null;
  }
  return state.panels.get(state.focusedPanelId) ?? null;
}

export function focusPanel(id: string): boolean {
  const panel = state.panels.get(id);
  if (!panel || !panel.visible) {
    return false;
  }

  const previousPanelId = state.focusedPanelId;

  // Update all panels' focused state
  const newPanels = new Map<string, Panel>();
  for (const [panelId, p] of state.panels) {
    newPanels.set(panelId, {
      ...p,
      focused: panelId === id,
    });
  }

  state = {
    ...state,
    panels: newPanels,
    focusedPanelId: id,
  };

  // Notify handlers
  notifyFocusChange({
    previousPanelId,
    newPanelId: id,
    panelName: panel.name,
    timestamp: Date.now(),
  });

  return true;
}

export function blurPanel(): void {
  const newPanels = new Map<string, Panel>();
  for (const [panelId, p] of state.panels) {
    newPanels.set(panelId, {
      ...p,
      focused: false,
    });
  }

  state = {
    ...state,
    panels: newPanels,
    focusedPanelId: null,
  };
}

export function focusNextPanel(): Panel | null {
  const visible = getVisiblePanels();
  if (visible.length === 0) {
    return null;
  }

  const currentIndex = state.focusedPanelId
    ? visible.findIndex(p => p.id === state.focusedPanelId)
    : -1;

  const nextIndex = (currentIndex + 1) % visible.length;
  const nextPanel = visible[nextIndex];

  focusPanel(nextPanel.id);
  return nextPanel;
}

export function focusPrevPanel(): Panel | null {
  const visible = getVisiblePanels();
  if (visible.length === 0) {
    return null;
  }

  const currentIndex = state.focusedPanelId
    ? visible.findIndex(p => p.id === state.focusedPanelId)
    : 0;

  const prevIndex = (currentIndex - 1 + visible.length) % visible.length;
  const prevPanel = visible[prevIndex];

  focusPanel(prevPanel.id);
  return prevPanel;
}

export function setPanelVisible(id: string, visible: boolean): Panel | null {
  const panel = state.panels.get(id);
  if (!panel) {
    return null;
  }

  const updated: Panel = {
    ...panel,
    visible,
  };

  const newPanels = new Map(state.panels);
  newPanels.set(id, updated);

  // If hiding the focused panel, clear focus
  const newFocusedId = !visible && state.focusedPanelId === id ? null : state.focusedPanelId;

  state = {
    ...state,
    panels: newPanels,
    focusedPanelId: newFocusedId,
  };

  return updated;
}

export function togglePanelVisible(id: string): Panel | null {
  const panel = state.panels.get(id);
  if (!panel) {
    return null;
  }

  return setPanelVisible(id, !panel.visible);
}

// ============================================================================
// Shortcut Management
// ============================================================================

export function getShortcut(id: string): KeyboardShortcut | null {
  return state.shortcuts.get(id) ?? null;
}

export function getAllShortcuts(): readonly KeyboardShortcut[] {
  return Array.from(state.shortcuts.values());
}

export function getShortcutsByCategory(category: ShortcutCategory): readonly KeyboardShortcut[] {
  return Array.from(state.shortcuts.values()).filter(s => s.category === category);
}

export function getEnabledShortcuts(): readonly KeyboardShortcut[] {
  return Array.from(state.shortcuts.values()).filter(s => s.enabled);
}

export function enableShortcut(id: string): KeyboardShortcut | null {
  const shortcut = state.shortcuts.get(id);
  if (!shortcut) {
    return null;
  }

  const updated: KeyboardShortcut = {
    ...shortcut,
    enabled: true,
  };

  const newShortcuts = new Map(state.shortcuts);
  newShortcuts.set(id, updated);

  state = {
    ...state,
    shortcuts: newShortcuts,
  };

  return updated;
}

export function disableShortcut(id: string): KeyboardShortcut | null {
  const shortcut = state.shortcuts.get(id);
  if (!shortcut) {
    return null;
  }

  const updated: KeyboardShortcut = {
    ...shortcut,
    enabled: false,
  };

  const newShortcuts = new Map(state.shortcuts);
  newShortcuts.set(id, updated);

  state = {
    ...state,
    shortcuts: newShortcuts,
  };

  return updated;
}

// ============================================================================
// Key Event Handling
// ============================================================================

export function handleKeyEvent(event: KeyEvent): ShortcutEvent | null {
  if (!state.enabled) {
    return null;
  }

  const matchedShortcut = findMatchingShortcut(event);
  if (!matchedShortcut || !matchedShortcut.enabled) {
    return null;
  }

  // Execute the action
  const prevented = executeAction(matchedShortcut);

  const shortcutEvent: ShortcutEvent = {
    shortcutId: matchedShortcut.id,
    action: matchedShortcut.action,
    key: matchedShortcut.key,
    modifiers: matchedShortcut.modifiers,
    timestamp: Date.now(),
    prevented,
  };

  // Notify handlers
  notifyShortcut(shortcutEvent);

  return shortcutEvent;
}

function findMatchingShortcut(event: KeyEvent): KeyboardShortcut | null {
  const modifierKey = state.useMetaKey ? event.metaKey : event.ctrlKey;

  for (const shortcut of state.shortcuts.values()) {
    if (!shortcut.enabled) {
      continue;
    }

    // Check key match
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase() &&
        event.code !== shortcut.key) {
      continue;
    }

    // Check modifiers
    const hasCmdMod = shortcut.modifiers.includes('cmd') || shortcut.modifiers.includes('meta');
    const hasCtrlMod = shortcut.modifiers.includes('ctrl');
    const hasAltMod = shortcut.modifiers.includes('alt');
    const hasShiftMod = shortcut.modifiers.includes('shift');

    const cmdMatch = hasCmdMod === modifierKey;
    const ctrlMatch = hasCtrlMod === event.ctrlKey || (hasCmdMod && !state.useMetaKey);
    const altMatch = hasAltMod === event.altKey;
    const shiftMatch = hasShiftMod === event.shiftKey;

    // For shortcuts with cmd modifier, we need special handling
    if (hasCmdMod) {
      if (modifierKey && altMatch && shiftMatch) {
        return shortcut;
      }
    } else {
      if (cmdMatch && altMatch && shiftMatch && !modifierKey) {
        return shortcut;
      }
    }
  }

  return null;
}

function executeAction(shortcut: KeyboardShortcut): boolean {
  switch (shortcut.action) {
    case 'focus_panel':
      // Extract panel from shortcut key
      const panelMap: Record<string, string> = { '1': 'chat', '2': 'preview', '3': 'editor' };
      const panelId = panelMap[shortcut.key];
      if (panelId) {
        return focusPanel(panelId);
      }
      return false;

    case 'next_panel':
      return focusNextPanel() !== null;

    case 'prev_panel':
      return focusPrevPanel() !== null;

    case 'toggle_preview':
      return togglePanelVisible('preview') !== null;

    case 'toggle_editor':
      return togglePanelVisible('editor') !== null;

    case 'blur_panel':
      blurPanel();
      return true;

    default:
      return false;
  }
}

// ============================================================================
// Shortcut String Formatting
// ============================================================================

export function formatShortcut(id: string): string {
  const shortcut = state.shortcuts.get(id);
  if (!shortcut) {
    return '';
  }

  return formatShortcutKeys(shortcut.modifiers, shortcut.key);
}

export function formatShortcutKeys(modifiers: readonly Modifier[], key: string): string {
  const parts: string[] = [];

  if (modifiers.includes('cmd') || modifiers.includes('meta')) {
    parts.push(state.useMetaKey ? '⌘' : 'Ctrl');
  }
  if (modifiers.includes('ctrl') && state.useMetaKey) {
    parts.push('Ctrl');
  }
  if (modifiers.includes('alt')) {
    parts.push(state.useMetaKey ? '⌥' : 'Alt');
  }
  if (modifiers.includes('shift')) {
    parts.push(state.useMetaKey ? '⇧' : 'Shift');
  }

  parts.push(key.toUpperCase());

  return parts.join(state.useMetaKey ? '' : '+');
}

export function getShortcutLabel(id: string): string {
  const shortcut = state.shortcuts.get(id);
  if (!shortcut) {
    return '';
  }

  return `${shortcut.description} (${formatShortcut(id)})`;
}

// ============================================================================
// Configuration
// ============================================================================

export function enable(): void {
  state = {
    ...state,
    enabled: true,
  };
}

export function disable(): void {
  state = {
    ...state,
    enabled: false,
  };
}

export function isEnabled(): boolean {
  return state.enabled;
}

export function setUseMetaKey(useMeta: boolean): void {
  state = {
    ...state,
    useMetaKey: useMeta,
  };
}

export function getUseMetaKey(): boolean {
  return state.useMetaKey;
}

export function detectPlatform(): void {
  // In a real implementation, this would detect the OS
  // For now, default to Mac style
  state = {
    ...state,
    useMetaKey: true,
  };
}

// ============================================================================
// Custom Shortcuts
// ============================================================================

export function addShortcut(shortcut: Omit<KeyboardShortcut, 'id'>): KeyboardShortcut {
  const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const newShortcut: KeyboardShortcut = {
    ...shortcut,
    id,
  };

  const newShortcuts = new Map(state.shortcuts);
  newShortcuts.set(id, newShortcut);

  state = {
    ...state,
    shortcuts: newShortcuts,
  };

  return newShortcut;
}

export function removeShortcut(id: string): boolean {
  if (!state.shortcuts.has(id)) {
    return false;
  }

  const newShortcuts = new Map(state.shortcuts);
  newShortcuts.delete(id);

  state = {
    ...state,
    shortcuts: newShortcuts,
  };

  return true;
}

export function updateShortcut(id: string, updates: Partial<KeyboardShortcut>): KeyboardShortcut | null {
  const shortcut = state.shortcuts.get(id);
  if (!shortcut) {
    return null;
  }

  const updated: KeyboardShortcut = {
    ...shortcut,
    ...updates,
    id, // Ensure ID cannot be changed
  };

  const newShortcuts = new Map(state.shortcuts);
  newShortcuts.set(id, updated);

  state = {
    ...state,
    shortcuts: newShortcuts,
  };

  return updated;
}

// ============================================================================
// Event Handlers
// ============================================================================

export function onShortcut(handler: ShortcutHandler): () => void {
  shortcutHandlers.push(handler);

  return () => {
    shortcutHandlers = shortcutHandlers.filter(h => h !== handler);
  };
}

export function onFocusChange(handler: FocusChangeHandler): () => void {
  focusHandlers.push(handler);

  return () => {
    focusHandlers = focusHandlers.filter(h => h !== handler);
  };
}

function notifyShortcut(event: ShortcutEvent): void {
  for (const handler of shortcutHandlers) {
    handler(event);
  }
}

function notifyFocusChange(event: FocusChangeEvent): void {
  for (const handler of focusHandlers) {
    handler(event);
  }
}

// ============================================================================
// Help Display
// ============================================================================

export interface ShortcutHelp {
  readonly category: ShortcutCategory;
  readonly shortcuts: readonly {
    readonly description: string;
    readonly keys: string;
  }[];
}

export function getShortcutHelp(): readonly ShortcutHelp[] {
  const categories: ShortcutCategory[] = ['navigation', 'view', 'editing', 'general', 'custom'];
  const help: ShortcutHelp[] = [];

  for (const category of categories) {
    const shortcuts = getShortcutsByCategory(category).filter(s => s.enabled);
    if (shortcuts.length > 0) {
      help.push({
        category,
        shortcuts: shortcuts.map(s => ({
          description: s.description,
          keys: formatShortcutKeys(s.modifiers, s.key),
        })),
      });
    }
  }

  return help;
}

export function getNavigationShortcuts(): readonly { panel: string; keys: string }[] {
  return [
    { panel: 'Chat', keys: formatShortcutKeys(['cmd'], '1') },
    { panel: 'Preview', keys: formatShortcutKeys(['cmd'], '2') },
    { panel: 'Editor', keys: formatShortcutKeys(['cmd'], '3') },
  ];
}

// ============================================================================
// State Inspection
// ============================================================================

export function getState(): KeyboardShortcutsState {
  return {
    ...state,
    shortcuts: new Map(state.shortcuts),
    panels: new Map(state.panels),
  };
}

export function hasShortcut(key: string, modifiers: readonly Modifier[]): boolean {
  for (const shortcut of state.shortcuts.values()) {
    if (shortcut.key === key &&
        shortcut.modifiers.length === modifiers.length &&
        shortcut.modifiers.every(m => modifiers.includes(m))) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Reset
// ============================================================================

export function resetKeyboardShortcuts(): void {
  state = {
    shortcuts: new Map(DEFAULT_SHORTCUTS.map(s => [s.id, s])),
    panels: new Map(DEFAULT_PANELS.map(p => [p.id, p])),
    focusedPanelId: null,
    enabled: true,
    useMetaKey: true,
  };
  shortcutHandlers = [];
  focusHandlers = [];
}
