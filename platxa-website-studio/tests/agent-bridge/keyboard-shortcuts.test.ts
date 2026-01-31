/**
 * Tests for Keyboard Shortcuts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPanel,
  getAllPanels,
  getVisiblePanels,
  getFocusedPanel,
  focusPanel,
  blurPanel,
  focusNextPanel,
  focusPrevPanel,
  setPanelVisible,
  togglePanelVisible,
  getShortcut,
  getAllShortcuts,
  getShortcutsByCategory,
  getEnabledShortcuts,
  enableShortcut,
  disableShortcut,
  handleKeyEvent,
  formatShortcut,
  formatShortcutKeys,
  getShortcutLabel,
  enable,
  disable,
  isEnabled,
  setUseMetaKey,
  getUseMetaKey,
  addShortcut,
  removeShortcut,
  updateShortcut,
  onShortcut,
  onFocusChange,
  getShortcutHelp,
  getNavigationShortcuts,
  getState,
  hasShortcut,
  resetKeyboardShortcuts,
  type ShortcutEvent,
  type FocusChangeEvent,
} from '../../lib/agent-bridge/keyboard-shortcuts';

describe('Keyboard Shortcuts', () => {
  beforeEach(() => {
    resetKeyboardShortcuts();
  });

  describe('Panel Management', () => {
    it('should get panel by id', () => {
      const panel = getPanel('chat');

      expect(panel).not.toBeNull();
      expect(panel?.name).toBe('Chat');
    });

    it('should return null for non-existent panel', () => {
      expect(getPanel('nonexistent')).toBeNull();
    });

    it('should get all panels in order', () => {
      const panels = getAllPanels();

      expect(panels.length).toBe(3);
      expect(panels[0].id).toBe('chat');
      expect(panels[1].id).toBe('preview');
      expect(panels[2].id).toBe('editor');
    });

    it('should get visible panels', () => {
      setPanelVisible('preview', false);

      const visible = getVisiblePanels();

      expect(visible.length).toBe(2);
      expect(visible.find(p => p.id === 'preview')).toBeUndefined();
    });

    it('should focus panel', () => {
      expect(focusPanel('chat')).toBe(true);
      expect(getFocusedPanel()?.id).toBe('chat');
    });

    it('should return false for non-existent panel', () => {
      expect(focusPanel('nonexistent')).toBe(false);
    });

    it('should return false for hidden panel', () => {
      setPanelVisible('preview', false);
      expect(focusPanel('preview')).toBe(false);
    });

    it('should blur panel', () => {
      focusPanel('chat');
      blurPanel();

      expect(getFocusedPanel()).toBeNull();
    });

    it('should focus next panel', () => {
      focusPanel('chat');
      const next = focusNextPanel();

      expect(next?.id).toBe('preview');
    });

    it('should wrap around to first panel', () => {
      focusPanel('editor');
      const next = focusNextPanel();

      expect(next?.id).toBe('chat');
    });

    it('should focus previous panel', () => {
      focusPanel('preview');
      const prev = focusPrevPanel();

      expect(prev?.id).toBe('chat');
    });

    it('should wrap around to last panel', () => {
      focusPanel('chat');
      const prev = focusPrevPanel();

      expect(prev?.id).toBe('editor');
    });

    it('should set panel visibility', () => {
      setPanelVisible('preview', false);

      expect(getPanel('preview')?.visible).toBe(false);
    });

    it('should toggle panel visibility', () => {
      togglePanelVisible('preview');
      expect(getPanel('preview')?.visible).toBe(false);

      togglePanelVisible('preview');
      expect(getPanel('preview')?.visible).toBe(true);
    });

    it('should clear focus when hiding focused panel', () => {
      focusPanel('preview');
      setPanelVisible('preview', false);

      expect(getFocusedPanel()).toBeNull();
    });
  });

  describe('Shortcut Management', () => {
    it('should get shortcut by id', () => {
      const shortcut = getShortcut('focus-chat');

      expect(shortcut).not.toBeNull();
      expect(shortcut?.key).toBe('1');
    });

    it('should return null for non-existent shortcut', () => {
      expect(getShortcut('nonexistent')).toBeNull();
    });

    it('should get all shortcuts', () => {
      const shortcuts = getAllShortcuts();

      expect(shortcuts.length).toBeGreaterThan(0);
    });

    it('should get shortcuts by category', () => {
      const navigation = getShortcutsByCategory('navigation');

      expect(navigation.length).toBeGreaterThan(0);
      expect(navigation.every(s => s.category === 'navigation')).toBe(true);
    });

    it('should get enabled shortcuts', () => {
      disableShortcut('focus-chat');

      const enabled = getEnabledShortcuts();

      expect(enabled.find(s => s.id === 'focus-chat')).toBeUndefined();
    });

    it('should enable shortcut', () => {
      disableShortcut('focus-chat');
      enableShortcut('focus-chat');

      expect(getShortcut('focus-chat')?.enabled).toBe(true);
    });

    it('should disable shortcut', () => {
      disableShortcut('focus-chat');

      expect(getShortcut('focus-chat')?.enabled).toBe(false);
    });

    it('should return null for non-existent shortcut', () => {
      expect(enableShortcut('nonexistent')).toBeNull();
      expect(disableShortcut('nonexistent')).toBeNull();
    });
  });

  describe('Key Event Handling', () => {
    it('should handle Cmd+1 to focus chat', () => {
      const event = handleKeyEvent({
        key: '1',
        code: 'Digit1',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(event).not.toBeNull();
      expect(event?.action).toBe('focus_panel');
      expect(getFocusedPanel()?.id).toBe('chat');
    });

    it('should handle Cmd+2 to focus preview', () => {
      const event = handleKeyEvent({
        key: '2',
        code: 'Digit2',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(event).not.toBeNull();
      expect(getFocusedPanel()?.id).toBe('preview');
    });

    it('should handle Cmd+3 to focus editor', () => {
      const event = handleKeyEvent({
        key: '3',
        code: 'Digit3',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(event).not.toBeNull();
      expect(getFocusedPanel()?.id).toBe('editor');
    });

    it('should return null when disabled', () => {
      disable();

      const event = handleKeyEvent({
        key: '1',
        code: 'Digit1',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(event).toBeNull();
    });

    it('should return null for non-matching key', () => {
      const event = handleKeyEvent({
        key: 'a',
        code: 'KeyA',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(event).toBeNull();
    });

    it('should use Ctrl key when useMetaKey is false', () => {
      setUseMetaKey(false);

      const event = handleKeyEvent({
        key: '1',
        code: 'Digit1',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      });

      expect(event).not.toBeNull();
      expect(getFocusedPanel()?.id).toBe('chat');
    });
  });

  describe('Shortcut Formatting', () => {
    it('should format shortcut with Mac symbols', () => {
      setUseMetaKey(true);
      const formatted = formatShortcut('focus-chat');

      expect(formatted).toBe('⌘1');
    });

    it('should format shortcut with Windows style', () => {
      setUseMetaKey(false);
      const formatted = formatShortcut('focus-chat');

      expect(formatted).toBe('Ctrl+1');
    });

    it('should format shortcut keys', () => {
      setUseMetaKey(true);
      const formatted = formatShortcutKeys(['cmd', 'shift'], 'P');

      expect(formatted).toBe('⌘⇧P');
    });

    it('should format shortcut keys Windows style', () => {
      setUseMetaKey(false);
      const formatted = formatShortcutKeys(['cmd', 'shift'], 'P');

      expect(formatted).toBe('Ctrl+Shift+P');
    });

    it('should get shortcut label', () => {
      const label = getShortcutLabel('focus-chat');

      expect(label).toContain('Focus chat panel');
      expect(label).toContain('⌘1');
    });

    it('should return empty string for non-existent shortcut', () => {
      expect(formatShortcut('nonexistent')).toBe('');
      expect(getShortcutLabel('nonexistent')).toBe('');
    });
  });

  describe('Configuration', () => {
    it('should be enabled by default', () => {
      expect(isEnabled()).toBe(true);
    });

    it('should disable shortcuts', () => {
      disable();
      expect(isEnabled()).toBe(false);
    });

    it('should enable shortcuts', () => {
      disable();
      enable();
      expect(isEnabled()).toBe(true);
    });

    it('should set use meta key', () => {
      setUseMetaKey(false);
      expect(getUseMetaKey()).toBe(false);
    });
  });

  describe('Custom Shortcuts', () => {
    it('should add custom shortcut', () => {
      const shortcut = addShortcut({
        key: 'k',
        modifiers: ['cmd'],
        action: 'custom_action',
        description: 'Custom action',
        category: 'custom',
        enabled: true,
        global: true,
      });

      expect(shortcut.id).toContain('custom_');
      expect(getShortcut(shortcut.id)).not.toBeNull();
    });

    it('should remove shortcut', () => {
      const shortcut = addShortcut({
        key: 'x',
        modifiers: ['cmd'],
        action: 'remove_me',
        description: 'To remove',
        category: 'custom',
        enabled: true,
        global: true,
      });

      expect(removeShortcut(shortcut.id)).toBe(true);
      expect(getShortcut(shortcut.id)).toBeNull();
    });

    it('should return false when removing non-existent shortcut', () => {
      expect(removeShortcut('nonexistent')).toBe(false);
    });

    it('should update shortcut', () => {
      const updated = updateShortcut('focus-chat', { description: 'Updated description' });

      expect(updated?.description).toBe('Updated description');
    });

    it('should not change shortcut id', () => {
      const updated = updateShortcut('focus-chat', { id: 'different-id' } as any);

      expect(updated?.id).toBe('focus-chat');
    });

    it('should return null for non-existent shortcut update', () => {
      expect(updateShortcut('nonexistent', { description: 'New' })).toBeNull();
    });
  });

  describe('Event Handlers', () => {
    it('should notify on shortcut', () => {
      const events: ShortcutEvent[] = [];
      onShortcut(event => events.push(event));

      handleKeyEvent({
        key: '1',
        code: 'Digit1',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(events.length).toBe(1);
      expect(events[0].shortcutId).toBe('focus-chat');
    });

    it('should notify on focus change', () => {
      const events: FocusChangeEvent[] = [];
      onFocusChange(event => events.push(event));

      focusPanel('preview');

      expect(events.length).toBe(1);
      expect(events[0].newPanelId).toBe('preview');
      expect(events[0].panelName).toBe('Preview');
    });

    it('should unsubscribe shortcut handler', () => {
      const events: ShortcutEvent[] = [];
      const unsubscribe = onShortcut(event => events.push(event));

      handleKeyEvent({
        key: '1',
        code: 'Digit1',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      unsubscribe();

      handleKeyEvent({
        key: '2',
        code: 'Digit2',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(events.length).toBe(1);
    });

    it('should unsubscribe focus handler', () => {
      const events: FocusChangeEvent[] = [];
      const unsubscribe = onFocusChange(event => events.push(event));

      focusPanel('chat');
      unsubscribe();
      focusPanel('preview');

      expect(events.length).toBe(1);
    });
  });

  describe('Help Display', () => {
    it('should get shortcut help', () => {
      const help = getShortcutHelp();

      expect(help.length).toBeGreaterThan(0);
      expect(help.find(h => h.category === 'navigation')).toBeDefined();
    });

    it('should get navigation shortcuts', () => {
      const nav = getNavigationShortcuts();

      expect(nav.length).toBe(3);
      expect(nav[0].panel).toBe('Chat');
      expect(nav[1].panel).toBe('Preview');
      expect(nav[2].panel).toBe('Editor');
    });
  });

  describe('State', () => {
    it('should return state copy', () => {
      const stateCopy = getState();

      expect(stateCopy.shortcuts.size).toBeGreaterThan(0);
      expect(stateCopy.panels.size).toBe(3);
    });

    it('should check if has shortcut', () => {
      expect(hasShortcut('1', ['cmd'])).toBe(true);
      expect(hasShortcut('x', ['cmd'])).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      focusPanel('chat');
      disableShortcut('focus-chat');
      disable();

      resetKeyboardShortcuts();

      expect(getFocusedPanel()).toBeNull();
      expect(getShortcut('focus-chat')?.enabled).toBe(true);
      expect(isEnabled()).toBe(true);
    });
  });

  describe('Verification: Cmd+1 focuses chat, Cmd+2 focuses preview, Cmd+3 focuses editor', () => {
    it('should focus chat with Cmd+1', () => {
      handleKeyEvent({
        key: '1',
        code: 'Digit1',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(getFocusedPanel()?.id).toBe('chat');
      expect(getFocusedPanel()?.name).toBe('Chat');
    });

    it('should focus preview with Cmd+2', () => {
      handleKeyEvent({
        key: '2',
        code: 'Digit2',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(getFocusedPanel()?.id).toBe('preview');
      expect(getFocusedPanel()?.name).toBe('Preview');
    });

    it('should focus editor with Cmd+3', () => {
      handleKeyEvent({
        key: '3',
        code: 'Digit3',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(getFocusedPanel()?.id).toBe('editor');
      expect(getFocusedPanel()?.name).toBe('Editor');
    });

    it('should cycle through all panels with shortcuts', () => {
      // Start with no focus
      expect(getFocusedPanel()).toBeNull();

      // Focus chat (Cmd+1)
      handleKeyEvent({
        key: '1',
        code: 'Digit1',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });
      expect(getFocusedPanel()?.id).toBe('chat');

      // Focus preview (Cmd+2)
      handleKeyEvent({
        key: '2',
        code: 'Digit2',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });
      expect(getFocusedPanel()?.id).toBe('preview');

      // Focus editor (Cmd+3)
      handleKeyEvent({
        key: '3',
        code: 'Digit3',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });
      expect(getFocusedPanel()?.id).toBe('editor');

      // Back to chat (Cmd+1)
      handleKeyEvent({
        key: '1',
        code: 'Digit1',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      });
      expect(getFocusedPanel()?.id).toBe('chat');
    });

    it('should display correct shortcut keys', () => {
      const nav = getNavigationShortcuts();

      expect(nav[0]).toEqual({ panel: 'Chat', keys: '⌘1' });
      expect(nav[1]).toEqual({ panel: 'Preview', keys: '⌘2' });
      expect(nav[2]).toEqual({ panel: 'Editor', keys: '⌘3' });
    });
  });
});
