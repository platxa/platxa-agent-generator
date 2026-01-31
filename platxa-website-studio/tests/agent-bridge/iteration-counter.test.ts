/**
 * Tests for Iteration Counter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  startSession,
  getSession,
  getActiveSession,
  getAllSessions,
  endSession,
  cancelSession,
  deleteSession,
  incrementIteration,
  getCurrentIteration,
  getIterationHistory,
  getLastIteration,
  increment,
  complete,
  fail,
  cancel,
  getCompletionMessage,
  formatCompletionText,
  getActiveCompletionMessage,
  getSessionSummary,
  getAllSessionSummaries,
  getTotalIterations,
  getTotalSessions,
  getAverageIterations,
  getSuccessRate,
  getSessionsByStatus,
  setDefaultMaxIterations,
  getDefaultMaxIterations,
  setSessionMaxIterations,
  getDisplayState,
  getActiveDisplayState,
  getProgressBar,
  onIteration,
  getState,
  hasActiveSession,
  getActiveSessionId,
  resetIterationCounter,
  type IterationEvent,
} from '../../lib/agent-bridge/iteration-counter';

describe('Iteration Counter', () => {
  beforeEach(() => {
    resetIterationCounter();
  });

  describe('Session Management', () => {
    it('should start a session', () => {
      const session = startSession('Test Session');

      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.iterations).toBe(0);
      expect(session.status).toBe('running');
    });

    it('should start session with custom max iterations', () => {
      const session = startSession('Test', 5);

      expect(session.maxIterations).toBe(5);
    });

    it('should use default max iterations', () => {
      const session = startSession('Test');

      expect(session.maxIterations).toBe(10);
    });

    it('should get session by id', () => {
      const created = startSession('Test');
      const retrieved = getSession(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Test');
    });

    it('should return null for non-existent session', () => {
      expect(getSession('nonexistent')).toBeNull();
    });

    it('should get active session', () => {
      startSession('Test');
      const active = getActiveSession();

      expect(active).not.toBeNull();
      expect(active?.name).toBe('Test');
    });

    it('should return null when no active session', () => {
      expect(getActiveSession()).toBeNull();
    });

    it('should get all sessions sorted by newest first', () => {
      startSession('First');
      startSession('Second');
      startSession('Third');

      const sessions = getAllSessions();

      expect(sessions.length).toBe(3);
      expect(sessions[0].name).toBe('Third');
      expect(sessions[2].name).toBe('First');
    });

    it('should end session', () => {
      const session = startSession('Test');
      const ended = endSession(session.id);

      expect(ended?.status).toBe('completed');
      expect(ended?.endTime).toBeGreaterThan(0);
    });

    it('should end session with custom status', () => {
      const session = startSession('Test');
      const ended = endSession(session.id, 'failed');

      expect(ended?.status).toBe('failed');
    });

    it('should cancel session', () => {
      const session = startSession('Test');
      const cancelled = cancelSession(session.id);

      expect(cancelled?.status).toBe('cancelled');
    });

    it('should delete session', () => {
      const session = startSession('Test');
      expect(deleteSession(session.id)).toBe(true);
      expect(getSession(session.id)).toBeNull();
    });

    it('should return false when deleting non-existent session', () => {
      expect(deleteSession('nonexistent')).toBe(false);
    });

    it('should clear active session when ended', () => {
      const session = startSession('Test');
      expect(hasActiveSession()).toBe(true);

      endSession(session.id);
      expect(hasActiveSession()).toBe(false);
    });
  });

  describe('Iteration Tracking', () => {
    it('should increment iteration', () => {
      const session = startSession('Test');
      const record = incrementIteration(session.id);

      expect(record).not.toBeNull();
      expect(record?.iteration).toBe(1);
      expect(getCurrentIteration(session.id)).toBe(1);
    });

    it('should increment with result and notes', () => {
      const session = startSession('Test');
      const record = incrementIteration(session.id, 'correction_needed', 'Fixed typo');

      expect(record?.result).toBe('correction_needed');
      expect(record?.notes).toBe('Fixed typo');
    });

    it('should track iteration history', () => {
      const session = startSession('Test');

      incrementIteration(session.id, 'correction_needed');
      incrementIteration(session.id, 'correction_needed');
      incrementIteration(session.id, 'success');

      const history = getIterationHistory(session.id);

      expect(history.length).toBe(3);
      expect(history[0].result).toBe('correction_needed');
      expect(history[2].result).toBe('success');
    });

    it('should get last iteration', () => {
      const session = startSession('Test');

      incrementIteration(session.id, 'correction_needed');
      incrementIteration(session.id, 'success');

      const last = getLastIteration(session.id);

      expect(last?.iteration).toBe(2);
      expect(last?.result).toBe('success');
    });

    it('should return null for empty history', () => {
      const session = startSession('Test');
      expect(getLastIteration(session.id)).toBeNull();
    });

    it('should timeout after max iterations', () => {
      const session = startSession('Test', 3);

      incrementIteration(session.id);
      incrementIteration(session.id);
      incrementIteration(session.id);

      const updated = getSession(session.id);
      expect(updated?.status).toBe('timeout');
    });

    it('should not increment ended session', () => {
      const session = startSession('Test');
      endSession(session.id);

      const record = incrementIteration(session.id);
      expect(record).toBeNull();
    });

    it('should track iteration duration', () => {
      const session = startSession('Test');
      const record = incrementIteration(session.id);

      expect(record?.duration).toBeGreaterThanOrEqual(0);
      expect(record?.startTime).toBeLessThanOrEqual(record?.endTime ?? 0);
    });
  });

  describe('Active Session Shortcuts', () => {
    it('should increment active session', () => {
      startSession('Test');
      const record = increment();

      expect(record?.iteration).toBe(1);
    });

    it('should complete active session', () => {
      startSession('Test');
      increment();
      const session = complete();

      expect(session?.status).toBe('completed');
    });

    it('should fail active session', () => {
      startSession('Test');
      increment();
      const session = fail();

      expect(session?.status).toBe('failed');
    });

    it('should cancel active session', () => {
      startSession('Test');
      const session = cancel();

      expect(session?.status).toBe('cancelled');
    });

    it('should return null when no active session', () => {
      expect(increment()).toBeNull();
      expect(complete()).toBeNull();
      expect(fail()).toBeNull();
      expect(cancel()).toBeNull();
    });
  });

  describe('Completion Messages', () => {
    it('should format completion text for single iteration', () => {
      const text = formatCompletionText(1, 'completed');
      expect(text).toBe('Completed in 1 iteration');
    });

    it('should format completion text for multiple iterations', () => {
      const text = formatCompletionText(2, 'completed');
      expect(text).toBe('Completed in 2 iterations');
    });

    it('should format completion text for 3 iterations', () => {
      const text = formatCompletionText(3, 'completed');
      expect(text).toBe('Completed in 3 iterations');
    });

    it('should format failed status', () => {
      const text = formatCompletionText(5, 'failed');
      expect(text).toBe('Failed after 5 iterations');
    });

    it('should format timeout status', () => {
      const text = formatCompletionText(10, 'timeout');
      expect(text).toBe('Timed out after 10 iterations');
    });

    it('should format cancelled status', () => {
      const text = formatCompletionText(3, 'cancelled');
      expect(text).toBe('Cancelled after 3 iterations');
    });

    it('should format running status', () => {
      const text = formatCompletionText(2, 'running');
      expect(text).toBe('Running (iteration 2)');
    });

    it('should get completion message', () => {
      const session = startSession('Test');
      incrementIteration(session.id);
      incrementIteration(session.id);
      endSession(session.id);

      const message = getCompletionMessage(session.id);

      expect(message?.text).toBe('Completed in 2 iterations');
      expect(message?.iterations).toBe(2);
      expect(message?.status).toBe('completed');
    });

    it('should get active completion message', () => {
      startSession('Test');
      increment();

      const message = getActiveCompletionMessage();

      expect(message?.text).toBe('Running (iteration 1)');
    });
  });

  describe('Session Summary', () => {
    it('should get session summary', () => {
      const session = startSession('Test');
      incrementIteration(session.id);
      incrementIteration(session.id);
      endSession(session.id);

      const summary = getSessionSummary(session.id);

      expect(summary?.name).toBe('Test');
      expect(summary?.iterations).toBe(2);
      expect(summary?.status).toBe('completed');
      expect(summary?.completionText).toBe('Completed in 2 iterations');
    });

    it('should return null for non-existent session', () => {
      expect(getSessionSummary('nonexistent')).toBeNull();
    });

    it('should get all session summaries', () => {
      startSession('First');
      increment();
      complete();

      startSession('Second');
      increment();
      increment();
      complete();

      const summaries = getAllSessionSummaries();

      expect(summaries.length).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should track total iterations', () => {
      startSession('Test');
      increment();
      increment();
      complete();

      startSession('Test 2');
      increment();

      expect(getTotalIterations()).toBe(3);
    });

    it('should track total sessions', () => {
      startSession('Test 1');
      startSession('Test 2');
      startSession('Test 3');

      expect(getTotalSessions()).toBe(3);
    });

    it('should calculate average iterations', () => {
      startSession('Test 1');
      increment();
      increment();
      complete();

      startSession('Test 2');
      increment();
      increment();
      increment();
      increment();
      complete();

      // (2 + 4) / 2 = 3
      expect(getAverageIterations()).toBe(3);
    });

    it('should return 0 for no completed sessions', () => {
      startSession('Test');
      increment();

      expect(getAverageIterations()).toBe(0);
    });

    it('should calculate success rate', () => {
      startSession('Test 1');
      increment();
      complete();

      startSession('Test 2');
      increment();
      complete();

      startSession('Test 3');
      increment();
      fail();

      // 2 completed out of 3 = 66.67%
      expect(getSuccessRate()).toBeCloseTo(66.67, 0);
    });

    it('should get sessions by status', () => {
      startSession('Test 1');
      complete();

      startSession('Test 2');
      complete();

      startSession('Test 3');
      fail();

      const completed = getSessionsByStatus('completed');
      const failed = getSessionsByStatus('failed');

      expect(completed.length).toBe(2);
      expect(failed.length).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should set default max iterations', () => {
      setDefaultMaxIterations(5);
      expect(getDefaultMaxIterations()).toBe(5);
    });

    it('should enforce minimum of 1', () => {
      setDefaultMaxIterations(0);
      expect(getDefaultMaxIterations()).toBe(1);
    });

    it('should set session max iterations', () => {
      const session = startSession('Test');
      setSessionMaxIterations(session.id, 15);

      const updated = getSession(session.id);
      expect(updated?.maxIterations).toBe(15);
    });
  });

  describe('Display Helpers', () => {
    it('should get display state', () => {
      const session = startSession('Test', 5);
      incrementIteration(session.id);
      incrementIteration(session.id);

      const display = getDisplayState(session.id);

      expect(display?.sessionName).toBe('Test');
      expect(display?.currentIteration).toBe(2);
      expect(display?.maxIterations).toBe(5);
      expect(display?.progress).toBe(40);
      expect(display?.canIncrement).toBe(true);
      expect(display?.canComplete).toBe(true);
    });

    it('should get active display state', () => {
      startSession('Active Test');
      increment();

      const display = getActiveDisplayState();

      expect(display?.sessionName).toBe('Active Test');
      expect(display?.isActive).toBe(true);
    });

    it('should generate progress bar', () => {
      const session = startSession('Test', 10);
      incrementIteration(session.id);
      incrementIteration(session.id);
      incrementIteration(session.id);
      incrementIteration(session.id);
      incrementIteration(session.id);

      const bar = getProgressBar(session.id, 10);

      expect(bar).toBe('[█████░░░░░]');
    });

    it('should return empty progress bar for non-existent session', () => {
      expect(getProgressBar('nonexistent')).toBe('');
    });
  });

  describe('Event Handlers', () => {
    it('should notify on iteration', () => {
      const events: IterationEvent[] = [];
      onIteration(event => events.push(event));

      const session = startSession('Test');
      incrementIteration(session.id, 'success');

      expect(events.length).toBe(1);
      expect(events[0].sessionId).toBe(session.id);
      expect(events[0].iteration).toBe(1);
      expect(events[0].result).toBe('success');
    });

    it('should unsubscribe handler', () => {
      const events: IterationEvent[] = [];
      const unsubscribe = onIteration(event => events.push(event));

      const session = startSession('Test');
      incrementIteration(session.id);

      unsubscribe();
      incrementIteration(session.id);

      expect(events.length).toBe(1);
    });
  });

  describe('State', () => {
    it('should return state copy', () => {
      startSession('Test');
      const stateCopy = getState();

      expect(stateCopy.sessions.size).toBe(1);
      expect(stateCopy.activeSessionId).not.toBeNull();
    });

    it('should check if has active session', () => {
      expect(hasActiveSession()).toBe(false);

      startSession('Test');
      expect(hasActiveSession()).toBe(true);
    });

    it('should get active session id', () => {
      expect(getActiveSessionId()).toBeNull();

      const session = startSession('Test');
      expect(getActiveSessionId()).toBe(session.id);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      startSession('Test');
      increment();
      setDefaultMaxIterations(5);

      resetIterationCounter();

      expect(hasActiveSession()).toBe(false);
      expect(getTotalIterations()).toBe(0);
      expect(getTotalSessions()).toBe(0);
      expect(getDefaultMaxIterations()).toBe(10);
    });
  });

  describe('Verification: Shows "Completed in 2 iterations" after multiple passes', () => {
    it('should show "Completed in 2 iterations" after two passes', () => {
      const session = startSession('Self-Correction');

      // First pass - needs correction
      incrementIteration(session.id, 'correction_needed');

      // Second pass - success
      incrementIteration(session.id, 'success');

      // Complete the session
      endSession(session.id);

      const message = getCompletionMessage(session.id);

      expect(message?.text).toBe('Completed in 2 iterations');
      expect(message?.iterations).toBe(2);
    });

    it('should show correct message after single pass', () => {
      const session = startSession('Quick Fix');

      incrementIteration(session.id, 'success');
      endSession(session.id);

      const message = getCompletionMessage(session.id);

      expect(message?.text).toBe('Completed in 1 iteration');
    });

    it('should show correct message after three passes', () => {
      const session = startSession('Complex Fix');

      incrementIteration(session.id, 'correction_needed');
      incrementIteration(session.id, 'correction_needed');
      incrementIteration(session.id, 'success');
      endSession(session.id);

      const message = getCompletionMessage(session.id);

      expect(message?.text).toBe('Completed in 3 iterations');
    });

    it('should track full self-correction workflow', () => {
      // Start a self-correction session
      const session = startSession('Code Review Fixes', 5);

      expect(session.status).toBe('running');
      expect(getCurrentIteration(session.id)).toBe(0);

      // First iteration - found issues
      incrementIteration(session.id, 'correction_needed', 'Found 3 issues');
      expect(getCurrentIteration(session.id)).toBe(1);

      // Second iteration - fixed issues, verify
      incrementIteration(session.id, 'success', 'All issues resolved');
      expect(getCurrentIteration(session.id)).toBe(2);

      // Complete
      const completed = endSession(session.id);

      expect(completed?.status).toBe('completed');
      expect(completed?.iterations).toBe(2);

      // Verify completion message
      const message = getCompletionMessage(session.id);
      expect(message?.text).toBe('Completed in 2 iterations');

      // Verify history
      const history = getIterationHistory(session.id);
      expect(history.length).toBe(2);
      expect(history[0].result).toBe('correction_needed');
      expect(history[1].result).toBe('success');
    });
  });
});
