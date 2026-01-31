/**
 * Tests for Plan History
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlan,
  getPlan,
  getCurrentPlan,
  updatePlan,
  deletePlan,
  addExplorationStep,
  completeExplorationStep,
  addRelatedFile,
  getSidebar,
  selectPlan,
  setFilterStatus,
  setSortOrder,
  setSearchQuery,
  restorePlan,
  duplicatePlan,
  getStats,
  exportHistory,
  importHistory,
  setMaxEntries,
  getMaxEntries,
  resetPlanHistory,
  formatTimestamp,
  formatDuration,
  getFormattedSidebarEntries,
  type PlanHistoryEntry,
  type ExplorationStep,
  type PlanHistorySidebar,
  type RestoreResult,
  type PlanHistoryStats,
} from '../../lib/agent-bridge/plan-history';

describe('Plan History', () => {
  beforeEach(() => {
    resetPlanHistory();
  });

  describe('Plan Management', () => {
    it('should create a new plan', () => {
      const plan = createPlan('How does the authentication system work?');

      expect(plan.id).toBeDefined();
      expect(plan.query).toBe('How does the authentication system work?');
      expect(plan.status).toBe('exploring');
      expect(plan.timestamp).toBeLessThanOrEqual(Date.now());
      expect(plan.explorationSteps).toEqual([]);
    });

    it('should generate title from query', () => {
      const plan = createPlan('Short query');
      expect(plan.title).toBe('Short query');
    });

    it('should truncate long queries for title', () => {
      const longQuery = 'This is a very long query that exceeds the maximum title length and should be truncated appropriately';
      const plan = createPlan(longQuery);

      expect(plan.title.length).toBeLessThanOrEqual(50);
      expect(plan.title.endsWith('...')).toBe(true);
    });

    it('should allow custom title', () => {
      const plan = createPlan('Some query', 'My Custom Title');
      expect(plan.title).toBe('My Custom Title');
    });

    it('should extract tags from query', () => {
      const plan = createPlan('Fix the bug in the component API');

      expect(plan.tags).toContain('bug');
      expect(plan.tags).toContain('component');
      expect(plan.tags).toContain('api');
    });

    it('should get plan by id', () => {
      const created = createPlan('Test query');
      const retrieved = getPlan(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent plan', () => {
      const plan = getPlan('non-existent-id');
      expect(plan).toBeNull();
    });

    it('should get current plan', () => {
      const plan = createPlan('Current exploration');
      const current = getCurrentPlan();

      expect(current).toEqual(plan);
    });

    it('should update plan', () => {
      const plan = createPlan('Initial query');
      const updated = updatePlan(plan.id, {
        title: 'Updated Title',
        status: 'completed',
        conclusions: ['Found the issue', 'Fixed it'],
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.status).toBe('completed');
      expect(updated?.conclusions).toEqual(['Found the issue', 'Fixed it']);
    });

    it('should return null when updating non-existent plan', () => {
      const result = updatePlan('non-existent', { title: 'New' });
      expect(result).toBeNull();
    });

    it('should delete plan', () => {
      const plan = createPlan('To be deleted');
      expect(deletePlan(plan.id)).toBe(true);
      expect(getPlan(plan.id)).toBeNull();
    });

    it('should return false when deleting non-existent plan', () => {
      expect(deletePlan('non-existent')).toBe(false);
    });

    it('should clear current plan when deleted', () => {
      const plan = createPlan('Current');
      deletePlan(plan.id);
      expect(getCurrentPlan()).toBeNull();
    });
  });

  describe('Exploration Steps', () => {
    it('should add exploration step', () => {
      const plan = createPlan('Exploring codebase');
      const step = addExplorationStep(plan.id, 'file-read', 'Reading auth.ts');

      expect(step?.id).toBeDefined();
      expect(step?.type).toBe('file-read');
      expect(step?.description).toBe('Reading auth.ts');
      expect(step?.result).toBeNull();
    });

    it('should return null when adding step to non-existent plan', () => {
      const step = addExplorationStep('non-existent', 'search', 'Searching');
      expect(step).toBeNull();
    });

    it('should complete exploration step', () => {
      const plan = createPlan('Testing steps');
      const step = addExplorationStep(plan.id, 'analysis', 'Analyzing code');

      const completed = completeExplorationStep(
        plan.id,
        step!.id,
        'Found 3 potential issues',
        1500
      );

      expect(completed).toBe(true);

      const updatedPlan = getPlan(plan.id);
      const updatedStep = updatedPlan?.explorationSteps[0];
      expect(updatedStep?.result).toBe('Found 3 potential issues');
      expect(updatedStep?.duration).toBe(1500);
    });

    it('should return false when completing non-existent step', () => {
      const plan = createPlan('Test');
      expect(completeExplorationStep(plan.id, 'non-existent', 'result', 100)).toBe(false);
    });

    it('should add related file', () => {
      const plan = createPlan('File exploration');
      expect(addRelatedFile(plan.id, 'src/auth.ts')).toBe(true);

      const updated = getPlan(plan.id);
      expect(updated?.relatedFiles).toContain('src/auth.ts');
    });

    it('should not duplicate related files', () => {
      const plan = createPlan('File exploration');
      addRelatedFile(plan.id, 'src/auth.ts');
      addRelatedFile(plan.id, 'src/auth.ts');

      const updated = getPlan(plan.id);
      expect(updated?.relatedFiles.filter(f => f === 'src/auth.ts').length).toBe(1);
    });

    it('should return false when adding file to non-existent plan', () => {
      expect(addRelatedFile('non-existent', 'file.ts')).toBe(false);
    });
  });

  describe('Sidebar Management', () => {
    it('should get sidebar state', () => {
      const sidebar = getSidebar();

      expect(sidebar.entries).toEqual([]);
      expect(sidebar.selectedId).toBeNull();
      expect(sidebar.filterStatus).toBe('all');
      expect(sidebar.sortOrder).toBe('newest');
    });

    it('should show plans in sidebar', () => {
      createPlan('First plan');
      createPlan('Second plan');

      const sidebar = getSidebar();
      expect(sidebar.entries.length).toBe(2);
    });

    it('should select plan', () => {
      const plan = createPlan('Selectable plan');
      expect(selectPlan(plan.id)).toBe(true);

      const sidebar = getSidebar();
      expect(sidebar.selectedId).toBe(plan.id);
    });

    it('should return false when selecting non-existent plan', () => {
      expect(selectPlan('non-existent')).toBe(false);
    });

    it('should allow deselecting plan', () => {
      const plan = createPlan('Plan');
      selectPlan(plan.id);
      selectPlan(null);

      expect(getSidebar().selectedId).toBeNull();
    });

    it('should filter by status', () => {
      const plan1 = createPlan('Exploring');
      const plan2 = createPlan('Completed');
      updatePlan(plan2.id, { status: 'completed' });

      setFilterStatus('completed');

      const sidebar = getSidebar();
      expect(sidebar.entries.length).toBe(1);
      expect(sidebar.entries[0].id).toBe(plan2.id);
    });

    it('should sort by newest', () => {
      const plan1 = createPlan('First');
      const plan2 = createPlan('Second');

      setSortOrder('newest');

      const sidebar = getSidebar();
      expect(sidebar.entries[0].id).toBe(plan2.id);
      expect(sidebar.entries[1].id).toBe(plan1.id);
    });

    it('should sort by oldest', () => {
      const plan1 = createPlan('First');
      const plan2 = createPlan('Second');

      setSortOrder('oldest');

      const sidebar = getSidebar();
      expect(sidebar.entries[0].id).toBe(plan1.id);
      expect(sidebar.entries[1].id).toBe(plan2.id);
    });

    it('should sort alphabetically', () => {
      createPlan('Zebra query', 'Zebra');
      createPlan('Apple query', 'Apple');

      setSortOrder('alphabetical');

      const sidebar = getSidebar();
      expect(sidebar.entries[0].title).toBe('Apple');
      expect(sidebar.entries[1].title).toBe('Zebra');
    });

    it('should search by query', () => {
      createPlan('Authentication flow');
      createPlan('Database queries');

      setSearchQuery('auth');

      const sidebar = getSidebar();
      expect(sidebar.entries.length).toBe(1);
      expect(sidebar.entries[0].query).toContain('Authentication');
    });

    it('should search by tag', () => {
      createPlan('Fix the bug in login');
      createPlan('Add new feature');

      setSearchQuery('bug');

      const sidebar = getSidebar();
      expect(sidebar.entries.length).toBe(1);
    });
  });

  describe('Restore Functionality', () => {
    it('should restore plan', () => {
      const plan = createPlan('Restoration test');
      addExplorationStep(plan.id, 'search', 'Searching files');
      addRelatedFile(plan.id, 'src/test.ts');
      updatePlan(plan.id, { conclusions: ['Found something'] });

      // Create another plan to change current
      createPlan('Another plan');

      const result = restorePlan(plan.id);

      expect(result.success).toBe(true);
      expect(result.entry?.id).toBe(plan.id);
      expect(result.restoredContext?.query).toBe('Restoration test');
      expect(result.restoredContext?.explorationSteps.length).toBe(1);
      expect(result.restoredContext?.relatedFiles).toContain('src/test.ts');
      expect(result.restoredContext?.conclusions).toContain('Found something');
    });

    it('should set restored plan as current', () => {
      const plan1 = createPlan('First');
      createPlan('Second');

      restorePlan(plan1.id);

      expect(getCurrentPlan()?.id).toBe(plan1.id);
    });

    it('should resume paused plan', () => {
      const plan = createPlan('Paused plan');
      updatePlan(plan.id, { status: 'paused' });

      restorePlan(plan.id);

      const updated = getPlan(plan.id);
      expect(updated?.status).toBe('exploring');
    });

    it('should return error for non-existent plan', () => {
      const result = restorePlan('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should duplicate plan', () => {
      const original = createPlan('Original query', 'Original Title');
      updatePlan(original.id, { description: 'Some description' });

      const duplicate = duplicatePlan(original.id);

      expect(duplicate).not.toBeNull();
      expect(duplicate?.id).not.toBe(original.id);
      expect(duplicate?.query).toBe('Original query');
      expect(duplicate?.title).toBe('Original Title (copy)');
    });

    it('should return null when duplicating non-existent plan', () => {
      expect(duplicatePlan('non-existent')).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should calculate stats', () => {
      const plan1 = createPlan('Completed exploration');
      updatePlan(plan1.id, { status: 'completed' });
      addExplorationStep(plan1.id, 'search', 'Step 1');
      addExplorationStep(plan1.id, 'analysis', 'Step 2');

      const plan2 = createPlan('Abandoned exploration');
      updatePlan(plan2.id, { status: 'abandoned' });
      addExplorationStep(plan2.id, 'search', 'Step 1');

      const stats = getStats();

      expect(stats.totalPlans).toBe(2);
      expect(stats.completedPlans).toBe(1);
      expect(stats.abandonedPlans).toBe(1);
      expect(stats.averageStepsPerPlan).toBe(1.5);
    });

    it('should track most used tags', () => {
      createPlan('Bug in component');
      createPlan('Another bug fix');
      createPlan('New feature');

      const stats = getStats();

      expect(stats.mostUsedTags.length).toBeGreaterThan(0);
      const bugTag = stats.mostUsedTags.find(t => t.tag === 'bug');
      expect(bugTag?.count).toBe(2);
    });

    it('should track recent activity', () => {
      createPlan('Today plan');

      const stats = getStats();

      expect(stats.recentActivity.length).toBe(7);
      // Today should have at least 1 plan
      expect(stats.recentActivity[6].count).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty history', () => {
      const stats = getStats();

      expect(stats.totalPlans).toBe(0);
      expect(stats.averageStepsPerPlan).toBe(0);
    });
  });

  describe('Import/Export', () => {
    it('should export history', () => {
      createPlan('Export test 1');
      createPlan('Export test 2');

      const exported = exportHistory();

      expect(exported.version).toBe(1);
      expect(exported.exportedAt).toBeLessThanOrEqual(Date.now());
      expect(exported.entries.length).toBe(2);
    });

    it('should import history with merge', () => {
      createPlan('Existing plan');

      const exported = exportHistory();
      resetPlanHistory();
      createPlan('New plan');

      const imported = importHistory(exported, true);

      expect(imported).toBe(1);
      expect(getSidebar().entries.length).toBe(2);
    });

    it('should import history without merge', () => {
      createPlan('Existing plan');
      const exported = exportHistory();

      createPlan('Will be replaced');

      const imported = importHistory(exported, false);

      expect(imported).toBe(1);
      expect(getSidebar().entries.length).toBe(1);
    });

    it('should not duplicate entries on merge', () => {
      const plan = createPlan('Original');
      const exported = exportHistory();

      const imported = importHistory(exported, true);

      expect(imported).toBe(0);
      expect(getSidebar().entries.length).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should set max entries', () => {
      setMaxEntries(50);
      expect(getMaxEntries()).toBe(50);
    });

    it('should enforce minimum of 1', () => {
      setMaxEntries(0);
      expect(getMaxEntries()).toBe(1);
    });

    it('should enforce max entries limit', () => {
      setMaxEntries(3);

      const plan1 = createPlan('First');
      updatePlan(plan1.id, { status: 'completed' });
      createPlan('Second');
      createPlan('Third');
      createPlan('Fourth');

      // Should have 3 entries (oldest completed one removed)
      expect(getSidebar().entries.length).toBe(3);
    });

    it('should not delete exploring or paused plans when enforcing limit', () => {
      setMaxEntries(2);

      const plan1 = createPlan('Exploring 1');
      const plan2 = createPlan('Exploring 2');
      const plan3 = createPlan('Exploring 3');

      // All exploring, none should be deleted
      expect(getSidebar().entries.length).toBe(3);
    });
  });

  describe('Formatting', () => {
    it('should format recent timestamp as "Just now"', () => {
      const now = Date.now();
      expect(formatTimestamp(now)).toBe('Just now');
    });

    it('should format minutes ago', () => {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      expect(formatTimestamp(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
      expect(formatTimestamp(threeHoursAgo)).toBe('3h ago');
    });

    it('should format days ago', () => {
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
      expect(formatTimestamp(twoDaysAgo)).toBe('2d ago');
    });

    it('should format old dates as date string', () => {
      const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      const formatted = formatTimestamp(twoWeeksAgo);
      expect(formatted).not.toContain('ago');
    });

    it('should format duration in milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format duration in seconds', () => {
      expect(formatDuration(2500)).toBe('2.5s');
    });

    it('should format duration in minutes', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should get formatted sidebar entries', () => {
      const plan = createPlan('Test query');
      addExplorationStep(plan.id, 'search', 'Searching');
      addRelatedFile(plan.id, 'file.ts');

      const entries = getFormattedSidebarEntries();

      expect(entries.length).toBe(1);
      expect(entries[0].title).toBe('Test query');
      expect(entries[0].formattedTimestamp).toBe('Just now');
      expect(entries[0].stepCount).toBe(1);
      expect(entries[0].fileCount).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      createPlan('Plan 1');
      createPlan('Plan 2');
      setFilterStatus('completed');
      setMaxEntries(50);

      resetPlanHistory();

      expect(getSidebar().entries.length).toBe(0);
      expect(getSidebar().filterStatus).toBe('all');
      expect(getMaxEntries()).toBe(100);
      expect(getCurrentPlan()).toBeNull();
    });
  });

  describe('Verification: Sidebar shows past plans with query and timestamp', () => {
    it('should display query in sidebar entries', () => {
      createPlan('How does the login flow work?');

      const entries = getFormattedSidebarEntries();

      expect(entries[0].query).toBe('How does the login flow work?');
    });

    it('should display timestamp in sidebar entries', () => {
      createPlan('Query with timestamp');

      const entries = getFormattedSidebarEntries();

      expect(entries[0].formattedTimestamp).toBeDefined();
      expect(entries[0].formattedTimestamp.length).toBeGreaterThan(0);
    });

    it('should show multiple past plans', () => {
      createPlan('First exploration');
      createPlan('Second exploration');
      createPlan('Third exploration');

      const entries = getFormattedSidebarEntries();

      expect(entries.length).toBe(3);
    });
  });

  describe('Verification: Click to restore', () => {
    it('should restore plan context on click simulation', () => {
      const plan = createPlan('Original exploration');
      addExplorationStep(plan.id, 'file-read', 'Reading files');
      addRelatedFile(plan.id, 'src/auth.ts');
      updatePlan(plan.id, { conclusions: ['Auth uses JWT tokens'] });

      // Simulate user creating a new plan (moving away)
      createPlan('New exploration');

      // Simulate click to restore (this is what happens when user clicks)
      const result = restorePlan(plan.id);

      expect(result.success).toBe(true);
      expect(result.restoredContext?.query).toBe('Original exploration');
      expect(result.restoredContext?.explorationSteps.length).toBe(1);
      expect(result.restoredContext?.relatedFiles).toContain('src/auth.ts');
      expect(result.restoredContext?.conclusions).toContain('Auth uses JWT tokens');
    });

    it('should set restored plan as active', () => {
      const plan1 = createPlan('Old plan');
      createPlan('Current plan');

      restorePlan(plan1.id);

      expect(getCurrentPlan()?.id).toBe(plan1.id);
      expect(getSidebar().selectedId).toBe(plan1.id);
    });
  });
});
