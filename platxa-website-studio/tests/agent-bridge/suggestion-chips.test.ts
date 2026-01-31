/**
 * Tests for Suggestion Chips
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getChip,
  getAllChips,
  getEnabledChips,
  getChipsByCategory,
  setContext,
  getContext,
  clearContext,
  updateVisibleChips,
  getVisibleChips,
  getDisplayState,
  setMaxVisible,
  getMaxVisible,
  showAllChips,
  enable,
  disable,
  isEnabled,
  enableChip,
  disableChip,
  selectChip,
  clearSelection,
  getSelectedChip,
  clickChip,
  onClick,
  addChip,
  removeChip,
  updateChip,
  getChipStyle,
  getCategoryStyle,
  showAfterPageGeneration,
  showAfterComponentGeneration,
  showAfterStyleChange,
  showAfterFullSiteGeneration,
  getState,
  hasVisibleChips,
  getChipCount,
  resetSuggestionChips,
  type ChipClickEvent,
} from '../../lib/agent-bridge/suggestion-chips';

describe('Suggestion Chips', () => {
  beforeEach(() => {
    resetSuggestionChips();
  });

  describe('Core Functions', () => {
    it('should get chip by id', () => {
      const chip = getChip('add-page');

      expect(chip).not.toBeNull();
      expect(chip?.label).toBe('Add another page');
    });

    it('should return null for non-existent chip', () => {
      expect(getChip('nonexistent')).toBeNull();
    });

    it('should get all chips', () => {
      const chips = getAllChips();

      expect(chips.length).toBeGreaterThan(0);
    });

    it('should get enabled chips', () => {
      disableChip('add-page');
      const enabled = getEnabledChips();

      expect(enabled.find(c => c.id === 'add-page')).toBeUndefined();
    });

    it('should get chips by category', () => {
      const designChips = getChipsByCategory('design');

      expect(designChips.length).toBeGreaterThan(0);
      expect(designChips.every(c => c.category === 'design')).toBe(true);
    });

    it('should sort chips by priority in category', () => {
      const designChips = getChipsByCategory('design');

      for (let i = 1; i < designChips.length; i++) {
        expect(designChips[i - 1].priority).toBeGreaterThanOrEqual(designChips[i].priority);
      }
    });
  });

  describe('Context-Aware Suggestions', () => {
    it('should set context', () => {
      setContext({
        generationType: 'page',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 0,
        customContext: {},
      });

      expect(getContext()).not.toBeNull();
      expect(getContext()?.generationType).toBe('page');
    });

    it('should update visible chips based on context', () => {
      setContext({
        generationType: 'page',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 0,
        customContext: {},
      });

      const visible = getVisibleChips();

      expect(visible.length).toBeGreaterThan(0);
    });

    it('should clear context', () => {
      setContext({
        generationType: 'page',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 0,
        customContext: {},
      });

      clearContext();

      expect(getContext()).toBeNull();
      expect(getVisibleChips().length).toBe(0);
    });

    it('should show deploy chip when not deployed', () => {
      setContext({
        generationType: 'page',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 0,
        customContext: {},
      });

      const visible = getVisibleChips();
      expect(visible.find(c => c.id === 'deploy')).toBeDefined();
    });

    it('should hide deploy chip when already deployed', () => {
      setContext({
        generationType: 'page',
        hasPages: true,
        hasStyles: true,
        hasDeployment: true,
        iterationCount: 0,
        customContext: {},
      });

      const visible = getVisibleChips();
      expect(visible.find(c => c.id === 'deploy')).toBeUndefined();
    });

    it('should show undo chip after iterations', () => {
      setContext({
        generationType: 'modification',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 2,
        customContext: {},
      });

      setMaxVisible(10);
      const visible = getVisibleChips();
      expect(visible.find(c => c.id === 'undo')).toBeDefined();
    });
  });

  describe('Visibility Control', () => {
    it('should respect max visible limit', () => {
      setMaxVisible(3);
      setContext({
        generationType: 'page',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 0,
        customContext: {},
      });

      expect(getVisibleChips().length).toBeLessThanOrEqual(3);
    });

    it('should get display state', () => {
      setMaxVisible(3);
      setContext({
        generationType: 'full_site',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 0,
        customContext: {},
      });

      const display = getDisplayState();

      expect(display.chips.length).toBeLessThanOrEqual(3);
      expect(display.hasMore).toBe(true);
      expect(display.totalCount).toBeGreaterThan(3);
    });

    it('should set max visible', () => {
      setMaxVisible(7);
      expect(getMaxVisible()).toBe(7);
    });

    it('should enforce minimum of 1', () => {
      setMaxVisible(0);
      expect(getMaxVisible()).toBe(1);
    });

    it('should show all chips temporarily', () => {
      setMaxVisible(2);
      setContext({
        generationType: 'full_site',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 1,
        customContext: {},
      });

      const all = showAllChips();

      expect(all.length).toBeGreaterThan(2);
      expect(getMaxVisible()).toBe(2); // Should restore original
    });
  });

  describe('Enable/Disable', () => {
    it('should be enabled by default', () => {
      expect(isEnabled()).toBe(true);
    });

    it('should disable chips', () => {
      setContext({
        generationType: 'page',
        hasPages: true,
        hasStyles: true,
        hasDeployment: false,
        iterationCount: 0,
        customContext: {},
      });

      disable();

      expect(isEnabled()).toBe(false);
      expect(getVisibleChips().length).toBe(0);
    });

    it('should enable chips', () => {
      disable();
      enable();

      expect(isEnabled()).toBe(true);
    });

    it('should enable specific chip', () => {
      disableChip('add-page');
      enableChip('add-page');

      expect(getChip('add-page')?.enabled).toBe(true);
    });

    it('should disable specific chip', () => {
      disableChip('add-page');

      expect(getChip('add-page')?.enabled).toBe(false);
    });

    it('should return null for non-existent chip', () => {
      expect(enableChip('nonexistent')).toBeNull();
      expect(disableChip('nonexistent')).toBeNull();
    });
  });

  describe('Selection', () => {
    it('should select chip', () => {
      expect(selectChip('add-page')).toBe(true);
      expect(getSelectedChip()?.id).toBe('add-page');
    });

    it('should return false for non-existent chip', () => {
      expect(selectChip('nonexistent')).toBe(false);
    });

    it('should clear selection', () => {
      selectChip('add-page');
      clearSelection();

      expect(getSelectedChip()).toBeNull();
    });
  });

  describe('Click Handling', () => {
    it('should handle chip click', () => {
      const event = clickChip('add-page');

      expect(event).not.toBeNull();
      expect(event?.chipId).toBe('add-page');
      expect(event?.action).toBe('add_page');
    });

    it('should return null for disabled chip', () => {
      disableChip('add-page');
      expect(clickChip('add-page')).toBeNull();
    });

    it('should notify click handlers', () => {
      const events: ChipClickEvent[] = [];
      onClick(event => events.push(event));

      clickChip('deploy');

      expect(events.length).toBe(1);
      expect(events[0].action).toBe('deploy');
    });

    it('should unsubscribe handler', () => {
      const events: ChipClickEvent[] = [];
      const unsubscribe = onClick(event => events.push(event));

      clickChip('deploy');
      unsubscribe();
      clickChip('preview');

      expect(events.length).toBe(1);
    });
  });

  describe('Custom Chips', () => {
    it('should add custom chip', () => {
      const chip = addChip({
        label: 'Custom Action',
        action: 'custom_action',
        icon: 'star',
        category: 'custom',
        priority: 50,
        enabled: true,
        tooltip: 'A custom action',
        shortcut: null,
      });

      expect(chip.id).toContain('custom_');
      expect(getChip(chip.id)).not.toBeNull();
    });

    it('should remove chip', () => {
      const chip = addChip({
        label: 'To Remove',
        action: 'remove',
        icon: null,
        category: 'custom',
        priority: 50,
        enabled: true,
        tooltip: null,
        shortcut: null,
      });

      expect(removeChip(chip.id)).toBe(true);
      expect(getChip(chip.id)).toBeNull();
    });

    it('should return false when removing non-existent chip', () => {
      expect(removeChip('nonexistent')).toBe(false);
    });

    it('should update chip', () => {
      const updated = updateChip('add-page', { label: 'Add New Page' });

      expect(updated?.label).toBe('Add New Page');
      expect(getChip('add-page')?.label).toBe('Add New Page');
    });

    it('should not change chip id', () => {
      const updated = updateChip('add-page', { id: 'different-id' } as any);

      expect(updated?.id).toBe('add-page');
    });

    it('should return null for non-existent chip update', () => {
      expect(updateChip('nonexistent', { label: 'New' })).toBeNull();
    });
  });

  describe('Chip Styling', () => {
    it('should get chip style', () => {
      const style = getChipStyle('add-page');

      expect(style).not.toBeNull();
      expect(style?.backgroundColor).toBeDefined();
      expect(style?.textColor).toBeDefined();
    });

    it('should return null for non-existent chip', () => {
      expect(getChipStyle('nonexistent')).toBeNull();
    });

    it('should get category style', () => {
      const style = getCategoryStyle('design');

      expect(style.backgroundColor).toBeDefined();
      expect(style.textColor).toBeDefined();
    });

    it('should have different styles for different categories', () => {
      const contentStyle = getCategoryStyle('content');
      const designStyle = getCategoryStyle('design');

      expect(contentStyle.backgroundColor).not.toBe(designStyle.backgroundColor);
    });
  });

  describe('Presets', () => {
    it('should show chips after page generation', () => {
      showAfterPageGeneration();

      expect(hasVisibleChips()).toBe(true);
      expect(getContext()?.generationType).toBe('page');
    });

    it('should show chips after component generation', () => {
      showAfterComponentGeneration();

      expect(hasVisibleChips()).toBe(true);
      expect(getContext()?.generationType).toBe('component');
    });

    it('should show chips after style change', () => {
      showAfterStyleChange();

      expect(hasVisibleChips()).toBe(true);
      expect(getContext()?.generationType).toBe('style');
    });

    it('should show chips after full site generation', () => {
      showAfterFullSiteGeneration();

      expect(hasVisibleChips()).toBe(true);
      expect(getContext()?.generationType).toBe('full_site');
    });
  });

  describe('State', () => {
    it('should return state copy', () => {
      const stateCopy = getState();

      expect(stateCopy.chips.size).toBeGreaterThan(0);
      expect(stateCopy.enabled).toBe(true);
    });

    it('should check if has visible chips', () => {
      expect(hasVisibleChips()).toBe(false);

      showAfterPageGeneration();

      expect(hasVisibleChips()).toBe(true);
    });

    it('should get chip count', () => {
      const count = getChipCount();

      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      showAfterPageGeneration();
      selectChip('add-page');
      disableChip('deploy');

      resetSuggestionChips();

      expect(getContext()).toBeNull();
      expect(getSelectedChip()).toBeNull();
      expect(getChip('deploy')?.enabled).toBe(true);
    });
  });

  describe('Verification: Chips appear after generation', () => {
    it('should show "Add another page" chip after generation', () => {
      showAfterPageGeneration();

      const visible = getVisibleChips();
      const addPageChip = visible.find(c => c.label === 'Add another page');

      expect(addPageChip).toBeDefined();
      expect(addPageChip?.action).toBe('add_page');
    });

    it('should show "Change colors" chip after generation', () => {
      showAfterPageGeneration();

      const visible = getVisibleChips();
      const changeColorsChip = visible.find(c => c.label === 'Change colors');

      expect(changeColorsChip).toBeDefined();
      expect(changeColorsChip?.action).toBe('change_colors');
    });

    it('should show "Deploy" chip after generation', () => {
      showAfterPageGeneration();

      const visible = getVisibleChips();
      const deployChip = visible.find(c => c.label === 'Deploy');

      expect(deployChip).toBeDefined();
      expect(deployChip?.action).toBe('deploy');
    });

    it('should show all three chips: Add another page, Change colors, Deploy', () => {
      setMaxVisible(10); // Ensure we can see all
      showAfterFullSiteGeneration();

      const visible = getVisibleChips();
      const labels = visible.map(c => c.label);

      expect(labels).toContain('Add another page');
      expect(labels).toContain('Change colors');
      expect(labels).toContain('Deploy');
    });

    it('should trigger action when chip is clicked', () => {
      showAfterPageGeneration();

      const actions: string[] = [];
      onClick(event => actions.push(event.action));

      clickChip('add-page');
      clickChip('change-colors');
      clickChip('deploy');

      expect(actions).toContain('add_page');
      expect(actions).toContain('change_colors');
      expect(actions).toContain('deploy');
    });
  });
});
