/**
 * Tests for User Satisfaction Tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackGeneration,
  isPendingFeedback,
  getPendingGenerations,
  dismissFeedbackPrompt,
  submitFeedback,
  submitPositive,
  submitNegative,
  submitNeutral,
  getFeedback,
  getFeedbackByGeneration,
  getAllFeedback,
  getFeedbackCount,
  queryFeedback,
  getPositiveFeedback,
  getNegativeFeedback,
  getRecentFeedback,
  getFeedbackByUser,
  getStats,
  getStatsByGenerationType,
  getStatsByUser,
  getTrend,
  getDailyTrend,
  getWeeklyTrend,
  onFeedback,
  getTagStats,
  getCommonTags,
  setMaxFeedback,
  getMaxFeedback,
  exportAnalytics,
  exportAnalyticsJson,
  getState,
  removeFeedback,
  clearFeedback,
  clearPending,
  resetSatisfactionTracking,
  formatStats,
  type SatisfactionFeedback,
  type SatisfactionStats,
} from '../../lib/agent-bridge/satisfaction-tracking';

describe('User Satisfaction Tracking', () => {
  beforeEach(() => {
    resetSatisfactionTracking();
  });

  describe('Generation Tracking', () => {
    describe('trackGeneration', () => {
      it('should track a generation as pending', () => {
        trackGeneration('gen-1');

        expect(isPendingFeedback('gen-1')).toBe(true);
      });

      it('should track multiple generations', () => {
        trackGeneration('gen-1');
        trackGeneration('gen-2');
        trackGeneration('gen-3');

        expect(getPendingGenerations().length).toBe(3);
      });
    });

    describe('isPendingFeedback', () => {
      it('should return false for unknown generation', () => {
        expect(isPendingFeedback('unknown')).toBe(false);
      });

      it('should return true for tracked generation', () => {
        trackGeneration('gen-1');
        expect(isPendingFeedback('gen-1')).toBe(true);
      });
    });

    describe('getPendingGenerations', () => {
      it('should return empty array initially', () => {
        expect(getPendingGenerations()).toEqual([]);
      });

      it('should return all pending generations', () => {
        trackGeneration('gen-1');
        trackGeneration('gen-2');

        const pending = getPendingGenerations();
        expect(pending).toContain('gen-1');
        expect(pending).toContain('gen-2');
      });
    });

    describe('dismissFeedbackPrompt', () => {
      it('should dismiss pending feedback', () => {
        trackGeneration('gen-1');
        expect(dismissFeedbackPrompt('gen-1')).toBe(true);
        expect(isPendingFeedback('gen-1')).toBe(false);
      });

      it('should return false for unknown generation', () => {
        expect(dismissFeedbackPrompt('unknown')).toBe(false);
      });
    });
  });

  describe('Feedback Submission', () => {
    describe('submitFeedback', () => {
      it('should submit feedback with basic info', () => {
        trackGeneration('gen-1');
        const feedback = submitFeedback('gen-1', 'user-1', 'positive');

        expect(feedback.id).toBeDefined();
        expect(feedback.generationId).toBe('gen-1');
        expect(feedback.userId).toBe('user-1');
        expect(feedback.rating).toBe('positive');
        expect(feedback.timestamp).toBeGreaterThan(0);
      });

      it('should submit feedback with comment', () => {
        trackGeneration('gen-1');
        const feedback = submitFeedback('gen-1', 'user-1', 'negative', {
          comment: 'Could be better',
        });

        expect(feedback.comment).toBe('Could be better');
      });

      it('should submit feedback with tags', () => {
        trackGeneration('gen-1');
        const feedback = submitFeedback('gen-1', 'user-1', 'positive', {
          tags: ['fast', 'accurate'],
        });

        expect(feedback.tags).toContain('fast');
        expect(feedback.tags).toContain('accurate');
      });

      it('should submit feedback with context', () => {
        trackGeneration('gen-1');
        const feedback = submitFeedback('gen-1', 'user-1', 'positive', {
          context: {
            generationType: 'page',
            promptLength: 100,
            responseTime: 500,
            iterationCount: 2,
            wasEdited: true,
          },
        });

        expect(feedback.context.generationType).toBe('page');
        expect(feedback.context.promptLength).toBe(100);
        expect(feedback.context.responseTime).toBe(500);
        expect(feedback.context.iterationCount).toBe(2);
        expect(feedback.context.wasEdited).toBe(true);
      });

      it('should remove from pending after submission', () => {
        trackGeneration('gen-1');
        submitFeedback('gen-1', 'user-1', 'positive');

        expect(isPendingFeedback('gen-1')).toBe(false);
      });
    });

    describe('submitPositive', () => {
      it('should submit positive feedback', () => {
        trackGeneration('gen-1');
        const feedback = submitPositive('gen-1', 'user-1');

        expect(feedback.rating).toBe('positive');
      });
    });

    describe('submitNegative', () => {
      it('should submit negative feedback', () => {
        trackGeneration('gen-1');
        const feedback = submitNegative('gen-1', 'user-1');

        expect(feedback.rating).toBe('negative');
      });
    });

    describe('submitNeutral', () => {
      it('should submit neutral feedback', () => {
        trackGeneration('gen-1');
        const feedback = submitNeutral('gen-1', 'user-1');

        expect(feedback.rating).toBe('neutral');
      });
    });
  });

  describe('Feedback Retrieval', () => {
    beforeEach(() => {
      trackGeneration('gen-1');
      trackGeneration('gen-2');
      trackGeneration('gen-3');
      submitPositive('gen-1', 'user-1');
      submitNegative('gen-2', 'user-1');
      submitPositive('gen-3', 'user-2');
    });

    describe('getFeedback', () => {
      it('should return feedback by ID', () => {
        const all = getAllFeedback();
        const retrieved = getFeedback(all[0].id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(all[0].id);
      });

      it('should return null for unknown ID', () => {
        expect(getFeedback('unknown')).toBeNull();
      });
    });

    describe('getFeedbackByGeneration', () => {
      it('should return feedback for generation', () => {
        const feedback = getFeedbackByGeneration('gen-1');

        expect(feedback).not.toBeNull();
        expect(feedback!.generationId).toBe('gen-1');
      });

      it('should return null for unknown generation', () => {
        expect(getFeedbackByGeneration('unknown')).toBeNull();
      });
    });

    describe('getAllFeedback', () => {
      it('should return all feedback sorted by timestamp', () => {
        const all = getAllFeedback();

        expect(all.length).toBe(3);
        expect(all[0].timestamp).toBeGreaterThanOrEqual(all[1].timestamp);
      });
    });

    describe('getFeedbackCount', () => {
      it('should return correct count', () => {
        expect(getFeedbackCount()).toBe(3);
      });
    });
  });

  describe('Query Functions', () => {
    beforeEach(() => {
      submitPositive('gen-1', 'user-1', {
        tags: ['fast'],
        context: { generationType: 'page' }
      });
      submitNegative('gen-2', 'user-1', {
        tags: ['slow'],
        context: { generationType: 'component' }
      });
      submitPositive('gen-3', 'user-2', {
        tags: ['fast'],
        context: { generationType: 'page' }
      });
    });

    describe('queryFeedback', () => {
      it('should filter by rating', () => {
        const results = queryFeedback({ rating: 'positive' });
        expect(results.length).toBe(2);
      });

      it('should filter by userId', () => {
        const results = queryFeedback({ userId: 'user-1' });
        expect(results.length).toBe(2);
      });

      it('should filter by generationType', () => {
        const results = queryFeedback({ generationType: 'page' });
        expect(results.length).toBe(2);
      });

      it('should filter by tags', () => {
        const results = queryFeedback({ hasTags: ['fast'] });
        expect(results.length).toBe(2);
      });

      it('should limit results', () => {
        const results = queryFeedback({ limit: 2 });
        expect(results.length).toBe(2);
      });
    });

    describe('getPositiveFeedback', () => {
      it('should return only positive feedback', () => {
        const results = getPositiveFeedback();
        expect(results.length).toBe(2);
        expect(results.every(f => f.rating === 'positive')).toBe(true);
      });
    });

    describe('getNegativeFeedback', () => {
      it('should return only negative feedback', () => {
        const results = getNegativeFeedback();
        expect(results.length).toBe(1);
        expect(results[0].rating).toBe('negative');
      });
    });

    describe('getRecentFeedback', () => {
      it('should return recent feedback with limit', () => {
        const results = getRecentFeedback(2);
        expect(results.length).toBe(2);
      });
    });

    describe('getFeedbackByUser', () => {
      it('should return feedback for user', () => {
        const results = getFeedbackByUser('user-1');
        expect(results.length).toBe(2);
      });
    });
  });

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return empty stats initially', () => {
        const stats = getStats();

        expect(stats.totalFeedback).toBe(0);
        expect(stats.positiveCount).toBe(0);
        expect(stats.negativeCount).toBe(0);
        expect(stats.positiveRate).toBe(0);
        expect(stats.netSatisfactionScore).toBe(0);
      });

      it('should calculate correct stats', () => {
        submitPositive('gen-1', 'user-1', { context: { responseTime: 100 } });
        submitPositive('gen-2', 'user-1', { context: { responseTime: 200 } });
        submitNegative('gen-3', 'user-1', { context: { responseTime: 300 } });
        submitNeutral('gen-4', 'user-1');

        const stats = getStats();

        expect(stats.totalFeedback).toBe(4);
        expect(stats.positiveCount).toBe(2);
        expect(stats.negativeCount).toBe(1);
        expect(stats.neutralCount).toBe(1);
        expect(stats.positiveRate).toBe(0.5);
        expect(stats.negativeRate).toBe(0.25);
        expect(stats.netSatisfactionScore).toBe(25); // (2-1)/4 * 100
        expect(stats.averageResponseTime).toBe(200); // (100+200+300)/3
      });

      it('should calculate feedback rate', () => {
        trackGeneration('gen-1');
        trackGeneration('gen-2');
        trackGeneration('gen-3');
        trackGeneration('gen-4');
        submitPositive('gen-1', 'user-1');
        submitPositive('gen-2', 'user-1');

        const stats = getStats();
        expect(stats.feedbackRate).toBe(0.5); // 2/4
      });
    });

    describe('getStatsByGenerationType', () => {
      it('should return stats for generation type', () => {
        submitPositive('gen-1', 'user-1', { context: { generationType: 'page' } });
        submitPositive('gen-2', 'user-1', { context: { generationType: 'page' } });
        submitNegative('gen-3', 'user-1', { context: { generationType: 'component' } });

        const pageStats = getStatsByGenerationType('page');
        expect(pageStats.totalFeedback).toBe(2);
        expect(pageStats.positiveRate).toBe(1);

        const componentStats = getStatsByGenerationType('component');
        expect(componentStats.totalFeedback).toBe(1);
        expect(componentStats.negativeRate).toBe(1);
      });
    });

    describe('getStatsByUser', () => {
      it('should return stats for user', () => {
        submitPositive('gen-1', 'user-1');
        submitNegative('gen-2', 'user-1');
        submitPositive('gen-3', 'user-2');

        const user1Stats = getStatsByUser('user-1');
        expect(user1Stats.totalFeedback).toBe(2);
        expect(user1Stats.netSatisfactionScore).toBe(0); // (1-1)/2 * 100

        const user2Stats = getStatsByUser('user-2');
        expect(user2Stats.totalFeedback).toBe(1);
        expect(user2Stats.positiveRate).toBe(1);
      });
    });
  });

  describe('Trends', () => {
    describe('getTrend', () => {
      it('should return trend data', () => {
        submitPositive('gen-1', 'user-1');
        submitPositive('gen-2', 'user-1');

        const trends = getTrend(60000, 3); // 1 minute periods

        expect(trends.length).toBe(3);
        expect(trends[0].startDate).toBeLessThan(trends[0].endDate);
      });
    });

    describe('getDailyTrend', () => {
      it('should return daily trends', () => {
        submitPositive('gen-1', 'user-1');

        const trends = getDailyTrend(7);

        expect(trends.length).toBe(7);
      });
    });

    describe('getWeeklyTrend', () => {
      it('should return weekly trends', () => {
        submitPositive('gen-1', 'user-1');

        const trends = getWeeklyTrend(4);

        expect(trends.length).toBe(4);
      });
    });
  });

  describe('Handlers', () => {
    describe('onFeedback', () => {
      it('should call handler on feedback', () => {
        const handler = vi.fn();
        onFeedback(handler);

        submitPositive('gen-1', 'user-1');

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          rating: 'positive',
        }));
      });

      it('should return unsubscribe function', () => {
        const handler = vi.fn();
        const unsubscribe = onFeedback(handler);

        submitPositive('gen-1', 'user-1');
        unsubscribe();
        submitPositive('gen-2', 'user-1');

        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Tags Analysis', () => {
    beforeEach(() => {
      submitPositive('gen-1', 'user-1', { tags: ['fast', 'accurate'] });
      submitPositive('gen-2', 'user-1', { tags: ['fast'] });
      submitNegative('gen-3', 'user-1', { tags: ['slow', 'inaccurate'] });
    });

    describe('getTagStats', () => {
      it('should return tag statistics', () => {
        const stats = getTagStats();

        expect(stats['fast'].count).toBe(2);
        expect(stats['fast'].positiveRate).toBe(1);
        expect(stats['slow'].count).toBe(1);
        expect(stats['slow'].positiveRate).toBe(0);
      });
    });

    describe('getCommonTags', () => {
      it('should return most common tags', () => {
        // Don't pass limit - get all tags sorted by frequency
        const tags = getCommonTags();

        expect(tags[0]).toBe('fast'); // 'fast' appears twice, most common
        expect(tags.length).toBe(4); // 4 unique tags: fast, accurate, slow, inaccurate
      });

      it('should respect limit', () => {
        const tags = getCommonTags(2);

        expect(tags.length).toBe(2);
      });
    });
  });

  describe('Retention', () => {
    describe('setMaxFeedback / getMaxFeedback', () => {
      it('should set and get max feedback', () => {
        setMaxFeedback(500);
        expect(getMaxFeedback()).toBe(500);
      });

      it('should enforce minimum of 1', () => {
        setMaxFeedback(0);
        expect(getMaxFeedback()).toBe(1);
      });

      it('should enforce max on set', () => {
        for (let i = 0; i < 10; i++) {
          submitPositive(`gen-${i}`, 'user-1');
        }

        setMaxFeedback(5);
        expect(getFeedbackCount()).toBe(5);
      });
    });
  });

  describe('Export and Analytics', () => {
    describe('exportAnalytics', () => {
      it('should export analytics data', () => {
        submitPositive('gen-1', 'user-1', { tags: ['fast'] });
        submitNegative('gen-2', 'user-1', { tags: ['slow'] });

        const analytics = exportAnalytics();

        expect(analytics.exportedAt).toBeGreaterThan(0);
        expect(analytics.stats.totalFeedback).toBe(2);
        expect(analytics.feedback.length).toBe(2);
        expect(analytics.tagStats).toBeDefined();
        expect(analytics.trends.length).toBe(7);
      });
    });

    describe('exportAnalyticsJson', () => {
      it('should export as JSON string', () => {
        submitPositive('gen-1', 'user-1');

        const json = exportAnalyticsJson();
        const parsed = JSON.parse(json);

        expect(parsed.stats.totalFeedback).toBe(1);
      });
    });

    describe('getState', () => {
      it('should return current state', () => {
        trackGeneration('gen-1');
        submitPositive('gen-2', 'user-1');

        const currentState = getState();

        expect(currentState.feedback.size).toBe(1);
        expect(currentState.pendingGenerations.size).toBe(1);
        expect(currentState.totalGenerations).toBe(1);
      });
    });
  });

  describe('Remove and Clear', () => {
    describe('removeFeedback', () => {
      it('should remove feedback by ID', () => {
        const feedback = submitPositive('gen-1', 'user-1');
        expect(removeFeedback(feedback.id)).toBe(true);
        expect(getFeedback(feedback.id)).toBeNull();
      });

      it('should return false for unknown ID', () => {
        expect(removeFeedback('unknown')).toBe(false);
      });
    });

    describe('clearFeedback', () => {
      it('should clear all feedback', () => {
        submitPositive('gen-1', 'user-1');
        submitPositive('gen-2', 'user-1');

        clearFeedback();

        expect(getFeedbackCount()).toBe(0);
      });
    });

    describe('clearPending', () => {
      it('should clear pending generations', () => {
        trackGeneration('gen-1');
        trackGeneration('gen-2');

        clearPending();

        expect(getPendingGenerations().length).toBe(0);
      });
    });
  });

  describe('resetSatisfactionTracking', () => {
    it('should reset all state', () => {
      trackGeneration('gen-1');
      submitPositive('gen-2', 'user-1');
      setMaxFeedback(500);

      resetSatisfactionTracking();

      expect(getFeedbackCount()).toBe(0);
      expect(getPendingGenerations().length).toBe(0);
      expect(getMaxFeedback()).toBe(1000);
    });
  });

  describe('Utility Functions', () => {
    describe('formatStats', () => {
      it('should format stats as string', () => {
        submitPositive('gen-1', 'user-1');
        submitNegative('gen-2', 'user-1');

        const stats = getStats();
        const formatted = formatStats(stats);

        expect(formatted).toContain('Total Feedback: 2');
        expect(formatted).toContain('Positive: 1');
        expect(formatted).toContain('Negative: 1');
        expect(formatted).toContain('Net Satisfaction Score:');
      });
    });
  });

  describe('Thumbs Up/Down Flow', () => {
    it('should track thumbs up after generation', () => {
      // Simulate generation completion
      trackGeneration('gen-123');
      expect(isPendingFeedback('gen-123')).toBe(true);

      // User gives thumbs up
      const feedback = submitPositive('gen-123', 'user-1');

      expect(feedback.rating).toBe('positive');
      expect(isPendingFeedback('gen-123')).toBe(false);
    });

    it('should track thumbs down with comment', () => {
      trackGeneration('gen-456');

      const feedback = submitNegative('gen-456', 'user-1', {
        comment: 'The colors were wrong',
        tags: ['design', 'colors'],
      });

      expect(feedback.rating).toBe('negative');
      expect(feedback.comment).toBe('The colors were wrong');
      expect(feedback.tags).toContain('design');
    });

    it('should track in analytics', () => {
      trackGeneration('gen-1');
      trackGeneration('gen-2');
      trackGeneration('gen-3');

      submitPositive('gen-1', 'user-1');
      submitPositive('gen-2', 'user-1');
      submitNegative('gen-3', 'user-2');

      const stats = getStats();
      expect(stats.totalFeedback).toBe(3);
      expect(stats.positiveRate).toBeCloseTo(0.667, 2);
      expect(stats.netSatisfactionScore).toBeCloseTo(33.33, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty feedback', () => {
      expect(getAllFeedback()).toEqual([]);
      expect(getStats().totalFeedback).toBe(0);
    });

    it('should handle feedback without tracking', () => {
      // Can submit feedback without tracking first
      const feedback = submitPositive('gen-untracked', 'user-1');
      expect(feedback.generationId).toBe('gen-untracked');
    });

    it('should enforce max feedback automatically', () => {
      setMaxFeedback(5);

      for (let i = 0; i < 10; i++) {
        submitPositive(`gen-${i}`, 'user-1');
      }

      expect(getFeedbackCount()).toBe(5);

      // Should keep most recent
      const all = getAllFeedback();
      expect(all[0].generationId).toBe('gen-9');
    });

    it('should handle multiple feedback same generation', () => {
      submitPositive('gen-1', 'user-1');
      submitNegative('gen-1', 'user-2');

      expect(getFeedbackCount()).toBe(2);
    });
  });
});
