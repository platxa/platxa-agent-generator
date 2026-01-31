/**
 * Tests for Version Pruning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getConfig,
  setConfig,
  setMaxVersions,
  getMaxVersions,
  setExemptStarred,
  isExemptStarred,
  setPruneOnCreate,
  isPruneOnCreate,
  setMinRetention,
  getMinRetention,
  enable,
  disable,
  isEnabled,
  addVersion,
  removeVersion,
  getVersion,
  getAllVersions,
  getVersionCount,
  setVersionStarred,
  toggleVersionStarred,
  prune,
  getPruneCandidates,
  wouldBePruned,
  isExempt,
  getSummary,
  getLastPruneTime,
  getTotalPruned,
  getRetentionStatus,
  importVersions,
  clearAllVersions,
  onPrune,
  getState,
  needsPruning,
  getStarredCount,
  getNonStarredCount,
  resetVersionPruning,
  type PruneEvent,
} from '../../lib/agent-bridge/version-pruning';

describe('Version Pruning', () => {
  beforeEach(() => {
    resetVersionPruning();
  });

  describe('Configuration', () => {
    it('should have default config', () => {
      const config = getConfig();

      expect(config.maxVersions).toBe(20);
      expect(config.exemptStarred).toBe(true);
      expect(config.pruneOnCreate).toBe(true);
      expect(config.minRetentionMs).toBe(0);
    });

    it('should update config partially', () => {
      setConfig({ maxVersions: 10 });

      const config = getConfig();
      expect(config.maxVersions).toBe(10);
      expect(config.exemptStarred).toBe(true); // Unchanged
    });

    it('should set max versions', () => {
      setMaxVersions(15);
      expect(getMaxVersions()).toBe(15);
    });

    it('should enforce minimum max versions of 1', () => {
      setMaxVersions(0);
      expect(getMaxVersions()).toBe(1);

      setMaxVersions(-5);
      expect(getMaxVersions()).toBe(1);
    });

    it('should set exempt starred', () => {
      setExemptStarred(false);
      expect(isExemptStarred()).toBe(false);

      setExemptStarred(true);
      expect(isExemptStarred()).toBe(true);
    });

    it('should set prune on create', () => {
      setPruneOnCreate(false);
      expect(isPruneOnCreate()).toBe(false);

      setPruneOnCreate(true);
      expect(isPruneOnCreate()).toBe(true);
    });

    it('should set min retention', () => {
      setMinRetention(60000);
      expect(getMinRetention()).toBe(60000);
    });

    it('should enforce non-negative min retention', () => {
      setMinRetention(-1000);
      expect(getMinRetention()).toBe(0);
    });
  });

  describe('Enable/Disable', () => {
    it('should be enabled by default', () => {
      expect(isEnabled()).toBe(true);
    });

    it('should disable pruning', () => {
      disable();
      expect(isEnabled()).toBe(false);
    });

    it('should enable pruning', () => {
      disable();
      enable();
      expect(isEnabled()).toBe(true);
    });
  });

  describe('Version Management', () => {
    it('should add version', () => {
      const version = addVersion('v1');

      expect(version.id).toBe('v1');
      expect(version.isStarred).toBe(false);
      expect(version.createdAt).toBeGreaterThan(0);
    });

    it('should add starred version', () => {
      const version = addVersion('v1', true);

      expect(version.isStarred).toBe(true);
    });

    it('should remove version', () => {
      addVersion('v1');
      expect(removeVersion('v1')).toBe(true);
      expect(getVersion('v1')).toBeNull();
    });

    it('should return false when removing non-existent version', () => {
      expect(removeVersion('nonexistent')).toBe(false);
    });

    it('should get version by id', () => {
      addVersion('v1');
      const version = getVersion('v1');

      expect(version).not.toBeNull();
      expect(version?.id).toBe('v1');
    });

    it('should return null for non-existent version', () => {
      expect(getVersion('nonexistent')).toBeNull();
    });

    it('should get all versions', () => {
      addVersion('v1');
      addVersion('v2');
      addVersion('v3');

      const versions = getAllVersions();
      expect(versions.length).toBe(3);
    });

    it('should get version count', () => {
      addVersion('v1');
      addVersion('v2');

      expect(getVersionCount()).toBe(2);
    });

    it('should set version starred', () => {
      addVersion('v1');
      setVersionStarred('v1', true);

      expect(getVersion('v1')?.isStarred).toBe(true);
    });

    it('should toggle version starred', () => {
      addVersion('v1');

      toggleVersionStarred('v1');
      expect(getVersion('v1')?.isStarred).toBe(true);

      toggleVersionStarred('v1');
      expect(getVersion('v1')?.isStarred).toBe(false);
    });

    it('should return null when setting starred on non-existent version', () => {
      expect(setVersionStarred('nonexistent', true)).toBeNull();
    });
  });

  describe('Pruning Logic', () => {
    beforeEach(() => {
      // Disable auto-prune for controlled testing
      setPruneOnCreate(false);
    });

    it('should prune versions beyond limit', () => {
      setMaxVersions(3);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');
      addVersion('v4');
      addVersion('v5');

      const result = prune();

      expect(result.prunedCount).toBe(2);
      expect(result.pruned).toContain('v1');
      expect(result.pruned).toContain('v2');
      expect(getVersionCount()).toBe(3);
    });

    it('should keep newest versions', () => {
      setMaxVersions(2);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');

      prune();

      expect(getVersion('v1')).toBeNull();
      expect(getVersion('v2')).not.toBeNull();
      expect(getVersion('v3')).not.toBeNull();
    });

    it('should exempt starred versions', () => {
      setMaxVersions(2);

      addVersion('v1', true); // starred
      addVersion('v2');
      addVersion('v3');
      addVersion('v4');

      const result = prune();

      expect(result.starredExempt).toContain('v1');
      expect(getVersion('v1')).not.toBeNull(); // Still exists
      expect(result.prunedCount).toBe(1); // Only v2 pruned
    });

    it('should not exempt starred when disabled', () => {
      setMaxVersions(2);
      setExemptStarred(false);

      addVersion('v1', true); // starred but not exempt
      addVersion('v2');
      addVersion('v3');
      addVersion('v4');

      const result = prune();

      expect(result.starredExempt.length).toBe(0);
      expect(result.prunedCount).toBe(2);
    });

    it('should not prune when under limit', () => {
      setMaxVersions(5);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');

      const result = prune();

      expect(result.prunedCount).toBe(0);
      expect(getVersionCount()).toBe(3);
    });

    it('should respect minimum retention', () => {
      setMaxVersions(1);
      setMinRetention(60000); // 1 minute

      addVersion('v1');
      addVersion('v2');

      const result = prune();

      // Both are too recent to prune
      expect(result.recentExempt.length).toBe(2);
      expect(result.prunedCount).toBe(0);
    });

    it('should return prune candidates', () => {
      setMaxVersions(2);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');
      addVersion('v4');

      const candidates = getPruneCandidates();

      expect(candidates.length).toBe(2);
      expect(candidates[0].id).toBe('v1'); // Oldest first
      expect(candidates[1].id).toBe('v2');
    });

    it('should check if version would be pruned', () => {
      setMaxVersions(2);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');

      expect(wouldBePruned('v1')).toBe(true);
      expect(wouldBePruned('v2')).toBe(false);
      expect(wouldBePruned('v3')).toBe(false);
    });

    it('should check if version is exempt', () => {
      addVersion('v1', true); // starred
      addVersion('v2');

      expect(isExempt('v1')).toBe(true);
      expect(isExempt('v2')).toBe(false);
    });
  });

  describe('Auto-Prune on Create', () => {
    it('should auto-prune when adding version', () => {
      setMaxVersions(3);
      setPruneOnCreate(true);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');
      addVersion('v4'); // Should trigger prune

      expect(getVersionCount()).toBe(3);
      expect(getVersion('v1')).toBeNull();
    });

    it('should not auto-prune when disabled', () => {
      setMaxVersions(3);
      setPruneOnCreate(false);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');
      addVersion('v4');

      expect(getVersionCount()).toBe(4); // No auto-prune
    });

    it('should not auto-prune when pruning disabled', () => {
      setMaxVersions(3);
      setPruneOnCreate(true);
      disable();

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');
      addVersion('v4');

      expect(getVersionCount()).toBe(4);
    });
  });

  describe('Summary and Statistics', () => {
    beforeEach(() => {
      setPruneOnCreate(false);
    });

    it('should return summary', () => {
      setMaxVersions(3);

      addVersion('v1', true); // starred (exempt)
      addVersion('v2');
      addVersion('v3');
      addVersion('v4');
      addVersion('v5'); // 4 non-starred exceeds limit of 3

      const summary = getSummary();

      expect(summary.totalVersions).toBe(5);
      expect(summary.starredVersions).toBe(1);
      expect(summary.overLimit).toBe(true);
      expect(summary.excessCount).toBe(1); // 4 non-starred, limit 3 = 1 excess
    });

    it('should track last prune time', () => {
      expect(getLastPruneTime()).toBeNull();

      setMaxVersions(1);
      addVersion('v1');
      addVersion('v2');
      prune();

      expect(getLastPruneTime()).toBeGreaterThan(0);
    });

    it('should track total pruned', () => {
      setMaxVersions(2);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');
      prune();

      addVersion('v4');
      prune();

      expect(getTotalPruned()).toBe(2);
    });

    it('should return retention status', () => {
      setMaxVersions(10);

      addVersion('v1');
      addVersion('v2');
      addVersion('v3');

      const status = getRetentionStatus();

      expect(status.current).toBe(3);
      expect(status.max).toBe(10);
      expect(status.percentage).toBe(30);
      expect(status.remaining).toBe(7);
    });

    it('should exclude starred from retention status', () => {
      setMaxVersions(10);

      addVersion('v1', true); // starred
      addVersion('v2');
      addVersion('v3');

      const status = getRetentionStatus();

      expect(status.current).toBe(2); // Only non-starred
    });

    it('should return starred count', () => {
      addVersion('v1', true);
      addVersion('v2', true);
      addVersion('v3');

      expect(getStarredCount()).toBe(2);
    });

    it('should return non-starred count', () => {
      addVersion('v1', true);
      addVersion('v2');
      addVersion('v3');

      expect(getNonStarredCount()).toBe(2);
    });

    it('should check if needs pruning', () => {
      setMaxVersions(2);

      addVersion('v1');
      addVersion('v2');
      expect(needsPruning()).toBe(false);

      addVersion('v3');
      expect(needsPruning()).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      setPruneOnCreate(false);
    });

    it('should import versions', () => {
      const count = importVersions([
        { id: 'v1', createdAt: Date.now() - 1000, isStarred: false },
        { id: 'v2', createdAt: Date.now() - 500, isStarred: true },
      ]);

      expect(count).toBe(2);
      expect(getVersionCount()).toBe(2);
      expect(getVersion('v2')?.isStarred).toBe(true);
    });

    it('should not import duplicates', () => {
      addVersion('v1');

      const count = importVersions([
        { id: 'v1', createdAt: Date.now(), isStarred: false },
        { id: 'v2', createdAt: Date.now(), isStarred: false },
      ]);

      expect(count).toBe(1); // Only v2 imported
      expect(getVersionCount()).toBe(2);
    });

    it('should clear all versions', () => {
      addVersion('v1');
      addVersion('v2');
      addVersion('v3');

      const count = clearAllVersions();

      expect(count).toBe(3);
      expect(getVersionCount()).toBe(0);
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      setPruneOnCreate(false);
    });

    it('should notify on prune', () => {
      const events: PruneEvent[] = [];
      onPrune(event => events.push(event));

      setMaxVersions(2);
      addVersion('v1');
      addVersion('v2');
      addVersion('v3');
      prune('manual');

      expect(events.length).toBe(1);
      expect(events[0].prunedIds).toContain('v1');
      expect(events[0].reason).toBe('manual');
      expect(events[0].previousCount).toBe(3);
      expect(events[0].newCount).toBe(2);
    });

    it('should not notify when nothing pruned', () => {
      const events: PruneEvent[] = [];
      onPrune(event => events.push(event));

      setMaxVersions(10);
      addVersion('v1');
      prune();

      expect(events.length).toBe(0);
    });

    it('should unsubscribe handler', () => {
      const events: PruneEvent[] = [];
      const unsubscribe = onPrune(event => events.push(event));

      setMaxVersions(1);
      addVersion('v1');
      addVersion('v2');
      prune();

      unsubscribe();

      addVersion('v3');
      prune();

      expect(events.length).toBe(1);
    });
  });

  describe('State', () => {
    it('should return state copy', () => {
      addVersion('v1');

      const stateCopy = getState();

      expect(stateCopy.versions.size).toBe(1);
      expect(stateCopy.enabled).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      setMaxVersions(5);
      addVersion('v1');
      addVersion('v2');
      disable();

      resetVersionPruning();

      expect(getMaxVersions()).toBe(20);
      expect(getVersionCount()).toBe(0);
      expect(isEnabled()).toBe(true);
    });
  });

  describe('Verification: Auto-delete versions beyond limit; starred versions exempt', () => {
    it('should auto-delete versions beyond limit of 20', () => {
      setMaxVersions(20);
      setPruneOnCreate(true);

      // Add 25 versions
      for (let i = 1; i <= 25; i++) {
        addVersion(`v${i}`);
      }

      // Should have exactly 20 versions
      expect(getVersionCount()).toBe(20);

      // Oldest 5 should be deleted
      expect(getVersion('v1')).toBeNull();
      expect(getVersion('v2')).toBeNull();
      expect(getVersion('v3')).toBeNull();
      expect(getVersion('v4')).toBeNull();
      expect(getVersion('v5')).toBeNull();

      // Newest 20 should remain
      expect(getVersion('v6')).not.toBeNull();
      expect(getVersion('v25')).not.toBeNull();
    });

    it('should keep starred versions exempt from auto-delete', () => {
      setMaxVersions(3);
      setPruneOnCreate(true);

      // Add versions with first one starred
      addVersion('v1', true); // starred - should be exempt
      addVersion('v2');
      addVersion('v3');
      addVersion('v4');
      addVersion('v5');

      // Starred v1 should still exist
      expect(getVersion('v1')).not.toBeNull();
      expect(getVersion('v1')?.isStarred).toBe(true);

      // Should have 4 versions (1 starred + 3 non-starred limit)
      expect(getVersionCount()).toBe(4);
    });

    it('should allow unlimited starred versions', () => {
      setMaxVersions(2);
      setPruneOnCreate(true);

      // Add many starred versions
      for (let i = 1; i <= 10; i++) {
        addVersion(`starred${i}`, true);
      }

      // All starred should remain
      expect(getVersionCount()).toBe(10);
      expect(getStarredCount()).toBe(10);
    });

    it('should prune non-starred even with many starred', () => {
      setMaxVersions(2);
      setPruneOnCreate(true);

      // Add starred versions
      addVersion('s1', true);
      addVersion('s2', true);

      // Add non-starred versions
      addVersion('n1');
      addVersion('n2');
      addVersion('n3');
      addVersion('n4');

      // All starred remain
      expect(getVersion('s1')).not.toBeNull();
      expect(getVersion('s2')).not.toBeNull();

      // Only 2 non-starred remain (newest)
      expect(getNonStarredCount()).toBe(2);
      expect(getVersion('n3')).not.toBeNull();
      expect(getVersion('n4')).not.toBeNull();

      // Oldest non-starred pruned
      expect(getVersion('n1')).toBeNull();
      expect(getVersion('n2')).toBeNull();
    });

    it('should complete full pruning workflow', () => {
      // Default limit of 20
      expect(getMaxVersions()).toBe(20);

      // Add 25 versions, some starred
      for (let i = 1; i <= 25; i++) {
        const isStarred = i === 1 || i === 5 || i === 10; // Star versions 1, 5, 10
        addVersion(`v${i}`, isStarred);
      }

      // Should have 23 versions: 3 starred (exempt) + 20 non-starred (limit)
      expect(getVersionCount()).toBe(23);
      expect(getStarredCount()).toBe(3);
      expect(getNonStarredCount()).toBe(20);

      // Starred versions should exist regardless of age
      expect(getVersion('v1')).not.toBeNull();
      expect(getVersion('v5')).not.toBeNull();
      expect(getVersion('v10')).not.toBeNull();
    });
  });
});
