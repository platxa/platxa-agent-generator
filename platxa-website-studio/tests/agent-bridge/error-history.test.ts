/**
 * Tests for Error History Tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addError,
  getError,
  getAllErrors,
  getErrorCount,
  startFix,
  completeFix,
  markIgnored,
  getFixStatus,
  queryErrors,
  getErrorsByType,
  getErrorsByStatus,
  getPendingErrors,
  getRecentErrors,
  getPattern,
  getAllPatterns,
  getFrequentPatterns,
  getStats,
  setMaxEntries,
  getMaxEntries,
  setRetention,
  getRetention,
  cleanupOldErrors,
  addTag,
  removeTag,
  getErrorsByTag,
  getDisplayData,
  exportHistory,
  getState,
  removeError,
  clearHistory,
  resetErrorHistory,
  type ErrorEntry,
  type FixStatus,
  type ErrorPattern,
  type HistoryStats,
} from '../../lib/agent-bridge/error-history';

describe('Error History Tracking', () => {
  beforeEach(() => {
    resetErrorHistory();
  });

  describe('addError', () => {
    it('should add an error with basic info', () => {
      const entry = addError('TypeError', 'undefined is not a function');

      expect(entry.id).toBeDefined();
      expect(entry.errorType).toBe('TypeError');
      expect(entry.errorMessage).toBe('undefined is not a function');
      expect(entry.fixStatus).toBe('pending');
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it('should add an error with context', () => {
      const entry = addError('SyntaxError', 'Unexpected token', {
        file: 'app.ts',
        line: 42,
        column: 10,
        component: 'Parser',
        operation: 'compile',
      });

      expect(entry.context.file).toBe('app.ts');
      expect(entry.context.line).toBe(42);
      expect(entry.context.column).toBe(10);
      expect(entry.context.component).toBe('Parser');
      expect(entry.context.operation).toBe('compile');
    });

    it('should add an error with options', () => {
      const entry = addError(
        'ValidationError',
        'Invalid input',
        {},
        { errorCode: 'E001', tags: ['critical', 'user-facing'] }
      );

      expect(entry.errorCode).toBe('E001');
      expect(entry.tags).toContain('critical');
      expect(entry.tags).toContain('user-facing');
    });

    it('should generate unique IDs', () => {
      const entry1 = addError('Error1', 'Message 1');
      const entry2 = addError('Error2', 'Message 2');

      expect(entry1.id).not.toBe(entry2.id);
    });

    it('should increment creation order', () => {
      const entry1 = addError('Error1', 'Message 1');
      const entry2 = addError('Error2', 'Message 2');
      const entry3 = addError('Error3', 'Message 3');

      expect(entry2.creationOrder).toBeGreaterThan(entry1.creationOrder);
      expect(entry3.creationOrder).toBeGreaterThan(entry2.creationOrder);
    });
  });

  describe('getError', () => {
    it('should return error by ID', () => {
      const added = addError('TestError', 'Test message');
      const retrieved = getError(added.id);

      expect(retrieved).toEqual(added);
    });

    it('should return null for unknown ID', () => {
      expect(getError('unknown-id')).toBeNull();
    });
  });

  describe('getAllErrors', () => {
    it('should return empty array initially', () => {
      expect(getAllErrors()).toEqual([]);
    });

    it('should return all errors sorted by timestamp desc', () => {
      const e1 = addError('Error1', 'Message 1');
      const e2 = addError('Error2', 'Message 2');
      const e3 = addError('Error3', 'Message 3');

      const all = getAllErrors();

      expect(all.length).toBe(3);
      // Most recent first (by creationOrder since same ms)
      expect(all[0].id).toBe(e3.id);
      expect(all[1].id).toBe(e2.id);
      expect(all[2].id).toBe(e1.id);
    });
  });

  describe('getErrorCount', () => {
    it('should return 0 initially', () => {
      expect(getErrorCount()).toBe(0);
    });

    it('should return correct count', () => {
      addError('Error1', 'Message 1');
      addError('Error2', 'Message 2');

      expect(getErrorCount()).toBe(2);
    });
  });

  describe('Fix Status Management', () => {
    describe('startFix', () => {
      it('should start a fix attempt', () => {
        const entry = addError('TestError', 'Test message');
        const attempt = startFix(entry.id, 'Trying to fix by refactoring');

        expect(attempt).not.toBeNull();
        expect(attempt!.description).toBe('Trying to fix by refactoring');
        expect(attempt!.success).toBe(false);
        expect(attempt!.duration).toBe(0);

        const updated = getError(entry.id);
        expect(updated!.fixStatus).toBe('in_progress');
        expect(updated!.fixAttempts.length).toBe(1);
      });

      it('should return null for unknown error', () => {
        expect(startFix('unknown-id', 'Description')).toBeNull();
      });
    });

    describe('completeFix', () => {
      it('should complete fix successfully', () => {
        const entry = addError('TestError', 'Test message');
        startFix(entry.id, 'Fix attempt');
        const completed = completeFix(entry.id, true);

        expect(completed).not.toBeNull();
        expect(completed!.fixStatus).toBe('fixed');
        expect(completed!.resolvedAt).toBeGreaterThan(0);
        expect(completed!.fixAttempts[0].success).toBe(true);
        expect(completed!.fixAttempts[0].duration).toBeGreaterThanOrEqual(0);
      });

      it('should complete fix as failed', () => {
        const entry = addError('TestError', 'Test message');
        startFix(entry.id, 'Fix attempt');
        const completed = completeFix(entry.id, false);

        expect(completed).not.toBeNull();
        expect(completed!.fixStatus).toBe('failed');
        expect(completed!.resolvedAt).toBeNull();
        expect(completed!.fixAttempts[0].success).toBe(false);
      });

      it('should return null if no fix started', () => {
        const entry = addError('TestError', 'Test message');
        expect(completeFix(entry.id, true)).toBeNull();
      });

      it('should return null for unknown error', () => {
        expect(completeFix('unknown-id', true)).toBeNull();
      });
    });

    describe('markIgnored', () => {
      it('should mark error as ignored', () => {
        const entry = addError('TestError', 'Test message');
        const ignored = markIgnored(entry.id);

        expect(ignored).not.toBeNull();
        expect(ignored!.fixStatus).toBe('ignored');
        expect(ignored!.resolvedAt).toBeGreaterThan(0);
      });

      it('should return null for unknown error', () => {
        expect(markIgnored('unknown-id')).toBeNull();
      });
    });

    describe('getFixStatus', () => {
      it('should return fix status', () => {
        const entry = addError('TestError', 'Test message');
        expect(getFixStatus(entry.id)).toBe('pending');

        startFix(entry.id, 'Fix');
        expect(getFixStatus(entry.id)).toBe('in_progress');

        completeFix(entry.id, true);
        expect(getFixStatus(entry.id)).toBe('fixed');
      });

      it('should return null for unknown error', () => {
        expect(getFixStatus('unknown-id')).toBeNull();
      });
    });
  });

  describe('Query Functions', () => {
    beforeEach(() => {
      addError('TypeError', 'Type error 1', {}, { tags: ['critical'] });
      addError('TypeError', 'Type error 2', {}, { tags: ['warning'] });
      addError('SyntaxError', 'Syntax error 1', {}, { tags: ['critical'] });
    });

    describe('queryErrors', () => {
      it('should filter by error type', () => {
        const results = queryErrors({ errorType: 'TypeError' });
        expect(results.length).toBe(2);
        expect(results.every(e => e.errorType === 'TypeError')).toBe(true);
      });

      it('should filter by fix status', () => {
        const all = getAllErrors();
        startFix(all[0].id, 'Fix');
        completeFix(all[0].id, true);

        const fixed = queryErrors({ fixStatus: 'fixed' });
        expect(fixed.length).toBe(1);
      });

      it('should filter by timestamp range', () => {
        const now = Date.now();
        const results = queryErrors({
          fromTimestamp: now - 1000,
          toTimestamp: now + 1000,
        });
        expect(results.length).toBe(3);
      });

      it('should filter by tags', () => {
        const results = queryErrors({ tags: ['critical'] });
        expect(results.length).toBe(2);
      });

      it('should limit results', () => {
        const results = queryErrors({ limit: 2 });
        expect(results.length).toBe(2);
      });
    });

    describe('getErrorsByType', () => {
      it('should return errors of specific type', () => {
        const results = getErrorsByType('TypeError');
        expect(results.length).toBe(2);
      });
    });

    describe('getErrorsByStatus', () => {
      it('should return errors by status', () => {
        const pending = getErrorsByStatus('pending');
        expect(pending.length).toBe(3);
      });
    });

    describe('getPendingErrors', () => {
      it('should return pending errors', () => {
        const pending = getPendingErrors();
        expect(pending.length).toBe(3);
      });
    });

    describe('getRecentErrors', () => {
      it('should return recent errors with default limit', () => {
        const recent = getRecentErrors();
        expect(recent.length).toBe(3);
      });

      it('should respect limit parameter', () => {
        const recent = getRecentErrors(2);
        expect(recent.length).toBe(2);
      });
    });
  });

  describe('Pattern Analysis', () => {
    describe('getPattern', () => {
      it('should return null for unknown type', () => {
        expect(getPattern('Unknown')).toBeNull();
      });

      it('should return pattern for known type', () => {
        addError('TypeError', 'Error 1');
        const pattern = getPattern('TypeError');

        expect(pattern).not.toBeNull();
        expect(pattern!.errorType).toBe('TypeError');
        expect(pattern!.occurrenceCount).toBe(1);
      });

      it('should track occurrence count', () => {
        addError('TypeError', 'Error 1');
        addError('TypeError', 'Error 2');
        addError('TypeError', 'Error 3');

        const pattern = getPattern('TypeError');
        expect(pattern!.occurrenceCount).toBe(3);
      });
    });

    describe('getAllPatterns', () => {
      it('should return empty array initially', () => {
        expect(getAllPatterns()).toEqual([]);
      });

      it('should return patterns sorted by occurrence', () => {
        addError('TypeError', 'Error 1');
        addError('TypeError', 'Error 2');
        addError('SyntaxError', 'Error 1');

        const patterns = getAllPatterns();
        expect(patterns.length).toBe(2);
        expect(patterns[0].errorType).toBe('TypeError');
        expect(patterns[1].errorType).toBe('SyntaxError');
      });
    });

    describe('getFrequentPatterns', () => {
      it('should return patterns with min occurrences', () => {
        addError('TypeError', 'E1');
        addError('TypeError', 'E2');
        addError('TypeError', 'E3');
        addError('SyntaxError', 'E1');

        const frequent = getFrequentPatterns(3);
        expect(frequent.length).toBe(1);
        expect(frequent[0].errorType).toBe('TypeError');
      });
    });

    it('should track fix success rate', () => {
      const e1 = addError('TypeError', 'Error 1');
      const e2 = addError('TypeError', 'Error 2');

      startFix(e1.id, 'Fix 1');
      completeFix(e1.id, true);

      startFix(e2.id, 'Fix 2');
      completeFix(e2.id, false);

      const pattern = getPattern('TypeError');
      expect(pattern!.fixSuccessRate).toBe(0.5);
    });
  });

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return empty stats initially', () => {
        const stats = getStats();

        expect(stats.totalErrors).toBe(0);
        expect(stats.fixedCount).toBe(0);
        expect(stats.pendingCount).toBe(0);
        expect(stats.failedCount).toBe(0);
        expect(stats.fixRate).toBe(0);
        expect(stats.averageFixTime).toBe(0);
        expect(stats.mostCommonType).toBeNull();
      });

      it('should calculate correct stats', () => {
        const e1 = addError('TypeError', 'Error 1');
        const e2 = addError('TypeError', 'Error 2');
        addError('SyntaxError', 'Error 1');

        startFix(e1.id, 'Fix');
        completeFix(e1.id, true);

        startFix(e2.id, 'Fix');
        completeFix(e2.id, false);

        const stats = getStats();

        expect(stats.totalErrors).toBe(3);
        expect(stats.fixedCount).toBe(1);
        expect(stats.pendingCount).toBe(1);
        expect(stats.failedCount).toBe(1);
        expect(stats.fixRate).toBe(0.5);
        expect(stats.mostCommonType).toBe('TypeError');
      });
    });
  });

  describe('Retention and Cleanup', () => {
    describe('setMaxEntries / getMaxEntries', () => {
      it('should set and get max entries', () => {
        setMaxEntries(100);
        expect(getMaxEntries()).toBe(100);
      });

      it('should enforce minimum of 1', () => {
        setMaxEntries(0);
        expect(getMaxEntries()).toBe(1);
      });

      it('should enforce max entries on set', () => {
        for (let i = 0; i < 10; i++) {
          addError('Error', `Message ${i}`);
        }

        setMaxEntries(5);
        expect(getErrorCount()).toBe(5);
      });
    });

    describe('setRetention / getRetention', () => {
      it('should set and get retention', () => {
        setRetention(3600000);
        expect(getRetention()).toBe(3600000);
      });

      it('should enforce minimum of 0', () => {
        setRetention(-1000);
        expect(getRetention()).toBe(0);
      });
    });

    describe('cleanupOldErrors', () => {
      it('should cleanup old errors based on retention', () => {
        addError('Error1', 'Message 1');
        addError('Error2', 'Message 2');

        // Set retention to 0 to cleanup all
        setRetention(0);
        const cleaned = cleanupOldErrors();

        expect(cleaned).toBe(2);
        expect(getErrorCount()).toBe(0);
      });

      it('should keep errors within retention period', () => {
        addError('Error1', 'Message 1');
        addError('Error2', 'Message 2');

        // Set retention to 1 hour
        setRetention(3600000);
        const cleaned = cleanupOldErrors();

        expect(cleaned).toBe(0);
        expect(getErrorCount()).toBe(2);
      });
    });
  });

  describe('Tags', () => {
    describe('addTag', () => {
      it('should add tag to error', () => {
        const entry = addError('TestError', 'Message');
        const updated = addTag(entry.id, 'important');

        expect(updated).not.toBeNull();
        expect(updated!.tags).toContain('important');
      });

      it('should not duplicate tags', () => {
        const entry = addError('TestError', 'Message', {}, { tags: ['existing'] });
        const updated = addTag(entry.id, 'existing');

        expect(updated!.tags.filter(t => t === 'existing').length).toBe(1);
      });

      it('should return null for unknown error', () => {
        expect(addTag('unknown-id', 'tag')).toBeNull();
      });
    });

    describe('removeTag', () => {
      it('should remove tag from error', () => {
        const entry = addError('TestError', 'Message', {}, { tags: ['tag1', 'tag2'] });
        const updated = removeTag(entry.id, 'tag1');

        expect(updated).not.toBeNull();
        expect(updated!.tags).not.toContain('tag1');
        expect(updated!.tags).toContain('tag2');
      });

      it('should return null for unknown error', () => {
        expect(removeTag('unknown-id', 'tag')).toBeNull();
      });
    });

    describe('getErrorsByTag', () => {
      it('should return errors with specific tag', () => {
        addError('Error1', 'M1', {}, { tags: ['critical'] });
        addError('Error2', 'M2', {}, { tags: ['warning'] });
        addError('Error3', 'M3', {}, { tags: ['critical'] });

        const results = getErrorsByTag('critical');
        expect(results.length).toBe(2);
      });
    });
  });

  describe('Export and Display', () => {
    describe('getDisplayData', () => {
      it('should return display data', () => {
        addError('TypeError', 'Error 1');
        addError('TypeError', 'Error 2');

        const data = getDisplayData();

        expect(data.errors.length).toBe(2);
        expect(data.stats.totalErrors).toBe(2);
        expect(data.patterns.length).toBe(0); // Less than 3 occurrences
      });
    });

    describe('exportHistory', () => {
      it('should export history as JSON', () => {
        addError('TestError', 'Test message');

        const exported = exportHistory();
        const parsed = JSON.parse(exported);

        expect(parsed.exportedAt).toBeGreaterThan(0);
        expect(parsed.entries.length).toBe(1);
        expect(parsed.stats.totalErrors).toBe(1);
      });
    });

    describe('getState', () => {
      it('should return current state', () => {
        addError('TestError', 'Test message');

        const currentState = getState();

        expect(currentState.entries.size).toBe(1);
        expect(currentState.maxEntries).toBeGreaterThan(0);
        expect(currentState.retentionMs).toBeGreaterThan(0);
      });
    });
  });

  describe('Remove and Clear', () => {
    describe('removeError', () => {
      it('should remove error by ID', () => {
        const entry = addError('TestError', 'Test message');
        expect(removeError(entry.id)).toBe(true);
        expect(getError(entry.id)).toBeNull();
      });

      it('should return false for unknown ID', () => {
        expect(removeError('unknown-id')).toBe(false);
      });
    });

    describe('clearHistory', () => {
      it('should clear all errors and patterns', () => {
        addError('Error1', 'Message 1');
        addError('Error2', 'Message 2');

        clearHistory();

        expect(getErrorCount()).toBe(0);
        expect(getAllPatterns().length).toBe(0);
      });

      it('should preserve settings', () => {
        setMaxEntries(100);
        setRetention(3600000);

        clearHistory();

        expect(getMaxEntries()).toBe(100);
        expect(getRetention()).toBe(3600000);
      });
    });
  });

  describe('resetErrorHistory', () => {
    it('should reset to defaults', () => {
      addError('TestError', 'Test message');
      setMaxEntries(100);
      setRetention(1000);

      resetErrorHistory();

      expect(getErrorCount()).toBe(0);
      expect(getAllPatterns().length).toBe(0);
      expect(getMaxEntries()).toBe(500);
      expect(getRetention()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple fix attempts', () => {
      const entry = addError('TestError', 'Test message');

      startFix(entry.id, 'Attempt 1');
      completeFix(entry.id, false);

      // Re-add to pending state
      const e = getError(entry.id)!;
      const newEntries = new Map(getState().entries);
      newEntries.set(entry.id, { ...e, fixStatus: 'pending' as FixStatus });

      startFix(entry.id, 'Attempt 2');

      const updated = getError(entry.id);
      expect(updated!.fixAttempts.length).toBe(2);
    });

    it('should track common contexts across occurrences', () => {
      addError('TypeError', 'E1', { file: 'app.ts', component: 'Button' });
      addError('TypeError', 'E2', { file: 'main.ts', component: 'Form' });

      const pattern = getPattern('TypeError');
      expect(pattern!.commonContexts).toContain('file:app.ts');
      expect(pattern!.commonContexts).toContain('file:main.ts');
    });

    it('should handle null context fields', () => {
      const entry = addError('TestError', 'Message');

      expect(entry.context.file).toBeNull();
      expect(entry.context.line).toBeNull();
      expect(entry.context.column).toBeNull();
      expect(entry.context.component).toBeNull();
      expect(entry.context.operation).toBeNull();
      expect(entry.context.stackTrace).toBeNull();
    });

    it('should enforce max entries automatically', () => {
      setMaxEntries(5);

      for (let i = 0; i < 10; i++) {
        addError('Error', `Message ${i}`);
      }

      expect(getErrorCount()).toBe(5);

      // Should keep most recent
      const all = getAllErrors();
      expect(all[0].errorMessage).toBe('Message 9');
    });

    it('should handle empty export', () => {
      const exported = exportHistory();
      const parsed = JSON.parse(exported);

      expect(parsed.entries).toEqual([]);
      expect(parsed.patterns).toEqual([]);
      expect(parsed.stats.totalErrors).toBe(0);
    });
  });
});
