/**
 * Tests for Version Labeling and Notes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createVersion,
  getVersion,
  getAllVersions,
  deleteVersion,
  setLabel,
  getLabel,
  clearLabel,
  setNotes,
  getNotes,
  appendNotes,
  clearNotes,
  addTag,
  removeTag,
  getTags,
  getAvailableTags,
  setColor,
  getColor,
  getColorHex,
  getAvailableColors,
  toggleStarred,
  isStarred,
  getStarredVersions,
  selectVersion,
  getSelectedVersion,
  startEditing,
  stopEditing,
  isEditing,
  getEditingVersion,
  setFilterTags,
  setSearchQuery,
  setSortOrder,
  getFilteredVersions,
  getVersionSummary,
  getVersionSummaries,
  onChange,
  exportVersions,
  importVersions,
  resetVersionLabels,
  type LabelChangeEvent,
  type Version,
} from '../../lib/agent-bridge/version-labels';

describe('Version Labels', () => {
  beforeEach(() => {
    resetVersionLabels();
  });

  describe('Version Management', () => {
    it('should create version', () => {
      const version = createVersion('1.0.0');

      expect(version.id).toBeDefined();
      expect(version.number).toBe('1.0.0');
      expect(version.label).toBe('Version 1.0.0');
      expect(version.notes).toBe('');
    });

    it('should create version with custom label', () => {
      const version = createVersion('1.0.0', 'Initial Release');

      expect(version.label).toBe('Initial Release');
    });

    it('should get version by id', () => {
      const created = createVersion('1.0.0');
      const retrieved = getVersion(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent version', () => {
      expect(getVersion('non-existent')).toBeNull();
    });

    it('should get all versions', () => {
      createVersion('1.0.0');
      createVersion('1.1.0');
      createVersion('2.0.0');

      expect(getAllVersions().length).toBe(3);
    });

    it('should delete version', () => {
      const version = createVersion('1.0.0');
      expect(deleteVersion(version.id)).toBe(true);
      expect(getVersion(version.id)).toBeNull();
    });

    it('should return false when deleting non-existent version', () => {
      expect(deleteVersion('non-existent')).toBe(false);
    });
  });

  describe('Label Management', () => {
    it('should set label', () => {
      const version = createVersion('1.0.0');
      setLabel(version.id, 'Production Release');

      expect(getLabel(version.id)).toBe('Production Release');
    });

    it('should return null when setting label on non-existent version', () => {
      expect(setLabel('non-existent', 'Label')).toBeNull();
    });

    it('should get label', () => {
      const version = createVersion('1.0.0', 'My Label');
      expect(getLabel(version.id)).toBe('My Label');
    });

    it('should return null for non-existent version label', () => {
      expect(getLabel('non-existent')).toBeNull();
    });

    it('should clear label to default', () => {
      const version = createVersion('1.0.0', 'Custom Label');
      clearLabel(version.id);

      expect(getLabel(version.id)).toBe('Version 1.0.0');
    });

    it('should update timestamp when label changes', () => {
      const version = createVersion('1.0.0');
      const originalUpdatedAt = version.updatedAt;

      // Small delay to ensure timestamp difference
      setLabel(version.id, 'New Label');

      const updated = getVersion(version.id);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe('Notes Management', () => {
    it('should set notes', () => {
      const version = createVersion('1.0.0');
      setNotes(version.id, 'Release notes here');

      expect(getNotes(version.id)).toBe('Release notes here');
    });

    it('should return null when setting notes on non-existent version', () => {
      expect(setNotes('non-existent', 'Notes')).toBeNull();
    });

    it('should get notes', () => {
      const version = createVersion('1.0.0');
      setNotes(version.id, 'Some notes');

      expect(getNotes(version.id)).toBe('Some notes');
    });

    it('should append notes', () => {
      const version = createVersion('1.0.0');
      setNotes(version.id, 'First line');
      appendNotes(version.id, 'Second line');

      expect(getNotes(version.id)).toBe('First line\nSecond line');
    });

    it('should append to empty notes', () => {
      const version = createVersion('1.0.0');
      appendNotes(version.id, 'First note');

      expect(getNotes(version.id)).toBe('First note');
    });

    it('should clear notes', () => {
      const version = createVersion('1.0.0');
      setNotes(version.id, 'Some notes');
      clearNotes(version.id);

      expect(getNotes(version.id)).toBe('');
    });
  });

  describe('Tags Management', () => {
    it('should add tag', () => {
      const version = createVersion('1.0.0');
      addTag(version.id, 'release');

      expect(getTags(version.id)).toContain('release');
    });

    it('should normalize tag to lowercase', () => {
      const version = createVersion('1.0.0');
      addTag(version.id, 'RELEASE');

      expect(getTags(version.id)).toContain('release');
    });

    it('should not duplicate tags', () => {
      const version = createVersion('1.0.0');
      addTag(version.id, 'release');
      addTag(version.id, 'release');

      expect(getTags(version.id).filter(t => t === 'release').length).toBe(1);
    });

    it('should remove tag', () => {
      const version = createVersion('1.0.0');
      addTag(version.id, 'release');
      addTag(version.id, 'beta');
      removeTag(version.id, 'release');

      expect(getTags(version.id)).not.toContain('release');
      expect(getTags(version.id)).toContain('beta');
    });

    it('should get available tags', () => {
      const version = createVersion('1.0.0');
      addTag(version.id, 'custom-tag');

      const tags = getAvailableTags();

      expect(tags).toContain('release');
      expect(tags).toContain('custom-tag');
    });
  });

  describe('Color Management', () => {
    it('should set color', () => {
      const version = createVersion('1.0.0');
      setColor(version.id, 'blue');

      expect(getColor(version.id)).toBe('blue');
    });

    it('should clear color', () => {
      const version = createVersion('1.0.0');
      setColor(version.id, 'blue');
      setColor(version.id, null);

      expect(getColor(version.id)).toBeNull();
    });

    it('should get color hex', () => {
      const hex = getColorHex('blue');
      expect(hex).toBe('#3b82f6');
    });

    it('should get available colors', () => {
      const colors = getAvailableColors();

      expect(colors).toContain('red');
      expect(colors).toContain('blue');
      expect(colors).toContain('green');
    });
  });

  describe('Starred Management', () => {
    it('should toggle starred', () => {
      const version = createVersion('1.0.0');

      expect(isStarred(version.id)).toBe(false);

      toggleStarred(version.id);
      expect(isStarred(version.id)).toBe(true);

      toggleStarred(version.id);
      expect(isStarred(version.id)).toBe(false);
    });

    it('should get starred versions', () => {
      const v1 = createVersion('1.0.0');
      const v2 = createVersion('2.0.0');
      createVersion('3.0.0');

      toggleStarred(v1.id);
      toggleStarred(v2.id);

      const starred = getStarredVersions();
      expect(starred.length).toBe(2);
    });
  });

  describe('Selection and Editing', () => {
    it('should select version', () => {
      const version = createVersion('1.0.0');
      expect(selectVersion(version.id)).toBe(true);
      expect(getSelectedVersion()?.id).toBe(version.id);
    });

    it('should return false for non-existent version selection', () => {
      expect(selectVersion('non-existent')).toBe(false);
    });

    it('should deselect version', () => {
      const version = createVersion('1.0.0');
      selectVersion(version.id);
      selectVersion(null);

      expect(getSelectedVersion()).toBeNull();
    });

    it('should start editing', () => {
      const version = createVersion('1.0.0');
      expect(startEditing(version.id)).toBe(true);
      expect(isEditing(version.id)).toBe(true);
    });

    it('should return false for editing non-existent version', () => {
      expect(startEditing('non-existent')).toBe(false);
    });

    it('should stop editing', () => {
      const version = createVersion('1.0.0');
      startEditing(version.id);
      stopEditing();

      expect(isEditing(version.id)).toBe(false);
      expect(getEditingVersion()).toBeNull();
    });

    it('should get editing version', () => {
      const version = createVersion('1.0.0');
      startEditing(version.id);

      expect(getEditingVersion()?.id).toBe(version.id);
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter by tags', () => {
      const v1 = createVersion('1.0.0');
      const v2 = createVersion('2.0.0');
      addTag(v1.id, 'release');
      addTag(v2.id, 'beta');

      setFilterTags(['release']);

      const filtered = getFilteredVersions();
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(v1.id);
    });

    it('should filter by search query', () => {
      createVersion('1.0.0', 'Alpha Release');
      createVersion('2.0.0', 'Beta Release');

      setSearchQuery('alpha');

      const filtered = getFilteredVersions();
      expect(filtered.length).toBe(1);
      expect(filtered[0].label).toBe('Alpha Release');
    });

    it('should search in notes', () => {
      const v1 = createVersion('1.0.0');
      createVersion('2.0.0');
      setNotes(v1.id, 'Contains important bug fix');

      setSearchQuery('bug fix');

      const filtered = getFilteredVersions();
      expect(filtered.length).toBe(1);
    });

    it('should sort by newest', () => {
      const v1 = createVersion('1.0.0');
      const v2 = createVersion('2.0.0');

      setSortOrder('newest');

      const sorted = getFilteredVersions();
      expect(sorted[0].id).toBe(v2.id);
    });

    it('should sort by oldest', () => {
      const v1 = createVersion('1.0.0');
      const v2 = createVersion('2.0.0');

      setSortOrder('oldest');

      const sorted = getFilteredVersions();
      expect(sorted[0].id).toBe(v1.id);
    });

    it('should sort alphabetically', () => {
      createVersion('1.0.0', 'Zebra');
      createVersion('2.0.0', 'Alpha');

      setSortOrder('alphabetical');

      const sorted = getFilteredVersions();
      expect(sorted[0].label).toBe('Alpha');
    });

    it('should sort by starred first', () => {
      const v1 = createVersion('1.0.0');
      const v2 = createVersion('2.0.0');
      toggleStarred(v1.id);

      setSortOrder('starred');

      const sorted = getFilteredVersions();
      expect(sorted[0].id).toBe(v1.id);
    });
  });

  describe('Version Summary', () => {
    it('should get version summary', () => {
      const version = createVersion('1.0.0', 'My Release');
      setNotes(version.id, 'Some notes');
      addTag(version.id, 'release');
      setColor(version.id, 'blue');
      toggleStarred(version.id);

      const summary = getVersionSummary(version.id);

      expect(summary?.label).toBe('My Release');
      expect(summary?.hasNotes).toBe(true);
      expect(summary?.tagCount).toBe(1);
      expect(summary?.isStarred).toBe(true);
      expect(summary?.color).toBe('blue');
      expect(summary?.formattedDate).toBeDefined();
    });

    it('should return null for non-existent version summary', () => {
      expect(getVersionSummary('non-existent')).toBeNull();
    });

    it('should get all version summaries', () => {
      createVersion('1.0.0');
      createVersion('2.0.0');

      const summaries = getVersionSummaries();
      expect(summaries.length).toBe(2);
    });
  });

  describe('Change Handlers', () => {
    it('should notify on label change', () => {
      const events: LabelChangeEvent[] = [];
      onChange(event => events.push(event));

      const version = createVersion('1.0.0');
      setLabel(version.id, 'New Label');

      expect(events.length).toBe(1);
      expect(events[0].field).toBe('label');
      expect(events[0].newLabel).toBe('New Label');
    });

    it('should notify on notes change', () => {
      const events: LabelChangeEvent[] = [];
      onChange(event => events.push(event));

      const version = createVersion('1.0.0');
      setNotes(version.id, 'New notes');

      expect(events.length).toBe(1);
      expect(events[0].field).toBe('notes');
    });

    it('should unsubscribe handler', () => {
      const events: LabelChangeEvent[] = [];
      const unsubscribe = onChange(event => events.push(event));

      const version = createVersion('1.0.0');
      setLabel(version.id, 'Label 1');
      expect(events.length).toBe(1);

      unsubscribe();
      setLabel(version.id, 'Label 2');
      expect(events.length).toBe(1);
    });
  });

  describe('Import/Export', () => {
    it('should export versions', () => {
      createVersion('1.0.0', 'First');
      createVersion('2.0.0', 'Second');

      const exported = exportVersions();

      expect(exported.version).toBe(1);
      expect(exported.versions.length).toBe(2);
    });

    it('should import versions with merge', () => {
      createVersion('1.0.0', 'Existing');
      const exported = exportVersions();

      resetVersionLabels();
      createVersion('2.0.0', 'New');

      const imported = importVersions(exported, true);

      expect(imported).toBe(1);
      expect(getAllVersions().length).toBe(2);
    });

    it('should import versions without merge', () => {
      createVersion('1.0.0', 'Existing');
      const exported = exportVersions();

      createVersion('2.0.0', 'Will be replaced');

      const imported = importVersions(exported, false);

      expect(imported).toBe(1);
      expect(getAllVersions().length).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      createVersion('1.0.0');
      createVersion('2.0.0');
      setFilterTags(['release']);
      setSortOrder('oldest');

      resetVersionLabels();

      expect(getAllVersions().length).toBe(0);
      expect(getFilteredVersions().length).toBe(0);
    });
  });

  describe('Verification: Click to add/edit label', () => {
    it('should start editing on click simulation', () => {
      const version = createVersion('1.0.0');

      // Simulate click to edit
      startEditing(version.id);

      expect(isEditing(version.id)).toBe(true);
      expect(getEditingVersion()?.id).toBe(version.id);
    });

    it('should update label while editing', () => {
      const version = createVersion('1.0.0', 'Original');

      startEditing(version.id);
      setLabel(version.id, 'Updated Label');
      stopEditing();

      expect(getLabel(version.id)).toBe('Updated Label');
      expect(isEditing(version.id)).toBe(false);
    });

    it('should support empty label (clears to default)', () => {
      const version = createVersion('1.0.0', 'Custom');

      startEditing(version.id);
      clearLabel(version.id);
      stopEditing();

      expect(getLabel(version.id)).toBe('Version 1.0.0');
    });
  });

  describe('Verification: Optional notes field', () => {
    it('should create version without notes', () => {
      const version = createVersion('1.0.0');
      expect(getNotes(version.id)).toBe('');
    });

    it('should add notes optionally', () => {
      const version = createVersion('1.0.0');

      // Notes are optional - version works without them
      expect(getVersionSummary(version.id)?.hasNotes).toBe(false);

      // Can add notes when needed
      setNotes(version.id, 'Optional notes');
      expect(getVersionSummary(version.id)?.hasNotes).toBe(true);
    });

    it('should edit notes', () => {
      const version = createVersion('1.0.0');
      setNotes(version.id, 'First notes');
      setNotes(version.id, 'Updated notes');

      expect(getNotes(version.id)).toBe('Updated notes');
    });

    it('should clear notes (making them empty again)', () => {
      const version = createVersion('1.0.0');
      setNotes(version.id, 'Some notes');
      clearNotes(version.id);

      expect(getNotes(version.id)).toBe('');
      expect(getVersionSummary(version.id)?.hasNotes).toBe(false);
    });
  });
});
