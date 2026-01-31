/**
 * Tests for A/B Testing Infrastructure
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createExperiment,
  getExperiment,
  getAllExperiments,
  getExperimentsByStatus,
  getRunningExperiments,
  startExperiment,
  pauseExperiment,
  resumeExperiment,
  completeExperiment,
  archiveExperiment,
  assignUser,
  getAssignment,
  getUserAssignments,
  getExperimentAssignments,
  getVariant,
  getVariantForUser,
  getVariantConfig,
  trackMetric,
  trackImpression,
  trackConversion,
  trackResponseTime,
  trackSatisfaction,
  trackError,
  getMetrics,
  getExperimentMetrics,
  compareVariants,
  evaluateTargeting,
  getState,
  getExperimentCount,
  getAssignmentCount,
  removeExperiment,
  clearAssignments,
  clearMetrics,
  resetABTesting,
  formatMetrics,
  type Experiment,
  type Variant,
  type UserContext,
} from '../../lib/agent-bridge/ab-testing';

describe('A/B Testing Infrastructure', () => {
  beforeEach(() => {
    resetABTesting();
  });

  describe('Experiment Management', () => {
    describe('createExperiment', () => {
      it('should create an experiment with variants', () => {
        const experiment = createExperiment('Test Experiment', [
          { name: 'Control', weight: 50, isControl: true, config: {} },
          { name: 'Variant A', weight: 50, isControl: false, config: { feature: true } },
        ]);

        expect(experiment.id).toBeDefined();
        expect(experiment.name).toBe('Test Experiment');
        expect(experiment.variants.length).toBe(2);
        expect(experiment.status).toBe('draft');
      });

      it('should create experiment with options', () => {
        const experiment = createExperiment('Test', [
          { name: 'Control', weight: 100, isControl: true, config: {} },
        ], {
          description: 'Test description',
          trafficAllocation: 50,
          metadata: { owner: 'team-a' },
        });

        expect(experiment.description).toBe('Test description');
        expect(experiment.trafficAllocation).toBe(50);
        expect(experiment.metadata.owner).toBe('team-a');
      });

      it('should assign unique IDs to variants', () => {
        const experiment = createExperiment('Test', [
          { name: 'Control', weight: 50, isControl: true, config: {} },
          { name: 'Variant', weight: 50, isControl: false, config: {} },
        ]);

        expect(experiment.variants[0].id).not.toBe(experiment.variants[1].id);
      });
    });

    describe('getExperiment', () => {
      it('should return experiment by ID', () => {
        const created = createExperiment('Test', [
          { name: 'Control', weight: 100, isControl: true, config: {} },
        ]);

        const retrieved = getExperiment(created.id);
        expect(retrieved).toEqual(created);
      });

      it('should return null for unknown ID', () => {
        expect(getExperiment('unknown')).toBeNull();
      });
    });

    describe('getAllExperiments', () => {
      it('should return all experiments sorted by date', () => {
        createExperiment('Exp 1', [{ name: 'C', weight: 100, isControl: true, config: {} }]);
        createExperiment('Exp 2', [{ name: 'C', weight: 100, isControl: true, config: {} }]);
        createExperiment('Exp 3', [{ name: 'C', weight: 100, isControl: true, config: {} }]);

        const all = getAllExperiments();
        expect(all.length).toBe(3);
        expect(all[0].createdAt).toBeGreaterThanOrEqual(all[1].createdAt);
      });
    });

    describe('getExperimentsByStatus', () => {
      it('should filter by status', () => {
        const exp1 = createExperiment('Exp 1', [{ name: 'C', weight: 100, isControl: true, config: {} }]);
        createExperiment('Exp 2', [{ name: 'C', weight: 100, isControl: true, config: {} }]);
        startExperiment(exp1.id);

        const running = getExperimentsByStatus('running');
        const draft = getExperimentsByStatus('draft');

        expect(running.length).toBe(1);
        expect(draft.length).toBe(1);
      });
    });

    describe('getRunningExperiments', () => {
      it('should return only running experiments', () => {
        const exp = createExperiment('Test', [{ name: 'C', weight: 100, isControl: true, config: {} }]);
        startExperiment(exp.id);

        const running = getRunningExperiments();
        expect(running.length).toBe(1);
        expect(running[0].status).toBe('running');
      });
    });
  });

  describe('Experiment Lifecycle', () => {
    let experiment: Experiment;

    beforeEach(() => {
      experiment = createExperiment('Test', [
        { name: 'Control', weight: 100, isControl: true, config: {} },
      ]);
    });

    describe('startExperiment', () => {
      it('should start a draft experiment', () => {
        const started = startExperiment(experiment.id);

        expect(started).not.toBeNull();
        expect(started!.status).toBe('running');
        expect(started!.startedAt).toBeGreaterThan(0);
      });

      it('should return null for non-draft experiment', () => {
        startExperiment(experiment.id);
        expect(startExperiment(experiment.id)).toBeNull();
      });
    });

    describe('pauseExperiment', () => {
      it('should pause a running experiment', () => {
        startExperiment(experiment.id);
        const paused = pauseExperiment(experiment.id);

        expect(paused).not.toBeNull();
        expect(paused!.status).toBe('paused');
      });

      it('should return null for non-running experiment', () => {
        expect(pauseExperiment(experiment.id)).toBeNull();
      });
    });

    describe('resumeExperiment', () => {
      it('should resume a paused experiment', () => {
        startExperiment(experiment.id);
        pauseExperiment(experiment.id);
        const resumed = resumeExperiment(experiment.id);

        expect(resumed).not.toBeNull();
        expect(resumed!.status).toBe('running');
      });

      it('should return null for non-paused experiment', () => {
        startExperiment(experiment.id);
        expect(resumeExperiment(experiment.id)).toBeNull();
      });
    });

    describe('completeExperiment', () => {
      it('should complete a running experiment', () => {
        startExperiment(experiment.id);
        const completed = completeExperiment(experiment.id);

        expect(completed).not.toBeNull();
        expect(completed!.status).toBe('completed');
        expect(completed!.endedAt).toBeGreaterThan(0);
      });

      it('should complete a paused experiment', () => {
        startExperiment(experiment.id);
        pauseExperiment(experiment.id);
        const completed = completeExperiment(experiment.id);

        expect(completed).not.toBeNull();
        expect(completed!.status).toBe('completed');
      });
    });

    describe('archiveExperiment', () => {
      it('should archive a completed experiment', () => {
        startExperiment(experiment.id);
        completeExperiment(experiment.id);
        const archived = archiveExperiment(experiment.id);

        expect(archived).not.toBeNull();
        expect(archived!.status).toBe('archived');
      });

      it('should return null for non-completed experiment', () => {
        startExperiment(experiment.id);
        expect(archiveExperiment(experiment.id)).toBeNull();
      });
    });
  });

  describe('User Assignment', () => {
    let experiment: Experiment;

    beforeEach(() => {
      experiment = createExperiment('Test', [
        { name: 'Control', weight: 50, isControl: true, config: {} },
        { name: 'Variant', weight: 50, isControl: false, config: { enabled: true } },
      ]);
      startExperiment(experiment.id);
    });

    describe('assignUser', () => {
      it('should assign user to experiment', () => {
        const assignment = assignUser('user-1', experiment.id);

        expect(assignment).not.toBeNull();
        expect(assignment!.odatabaseId).toBe('user-1');
        expect(assignment!.experimentId).toBe(experiment.id);
        expect(assignment!.variantId).toBeDefined();
      });

      it('should return same assignment for same user', () => {
        const first = assignUser('user-1', experiment.id);
        const second = assignUser('user-1', experiment.id);

        expect(first).toEqual(second);
      });

      it('should return null for non-running experiment', () => {
        pauseExperiment(experiment.id);
        expect(assignUser('user-1', experiment.id)).toBeNull();
      });

      it('should respect traffic allocation', () => {
        const lowTrafficExp = createExperiment('Low Traffic', [
          { name: 'Control', weight: 100, isControl: true, config: {} },
        ], { trafficAllocation: 0 });
        startExperiment(lowTrafficExp.id);

        // With 0% traffic, no users should be assigned
        expect(assignUser('user-1', lowTrafficExp.id)).toBeNull();
      });
    });

    describe('getAssignment', () => {
      it('should return assignment for user', () => {
        assignUser('user-1', experiment.id);
        const assignment = getAssignment('user-1', experiment.id);

        expect(assignment).not.toBeNull();
        expect(assignment!.odatabaseId).toBe('user-1');
      });

      it('should return null for unassigned user', () => {
        expect(getAssignment('unknown', experiment.id)).toBeNull();
      });
    });

    describe('getUserAssignments', () => {
      it('should return all assignments for user', () => {
        const exp2 = createExperiment('Exp 2', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ]);
        startExperiment(exp2.id);

        assignUser('user-1', experiment.id);
        assignUser('user-1', exp2.id);

        const assignments = getUserAssignments('user-1');
        expect(assignments.length).toBe(2);
      });
    });

    describe('getExperimentAssignments', () => {
      it('should return all assignments for experiment', () => {
        assignUser('user-1', experiment.id);
        assignUser('user-2', experiment.id);
        assignUser('user-3', experiment.id);

        const assignments = getExperimentAssignments(experiment.id);
        expect(assignments.length).toBe(3);
      });
    });
  });

  describe('Variant Access', () => {
    let experiment: Experiment;

    beforeEach(() => {
      experiment = createExperiment('Test', [
        { name: 'Control', weight: 50, isControl: true, config: { color: 'blue' } },
        { name: 'Variant', weight: 50, isControl: false, config: { color: 'green' } },
      ]);
      startExperiment(experiment.id);
    });

    describe('getVariant', () => {
      it('should return variant by ID', () => {
        const variant = getVariant(experiment.id, experiment.variants[0].id);

        expect(variant).not.toBeNull();
        expect(variant!.name).toBe('Control');
      });

      it('should return null for unknown variant', () => {
        expect(getVariant(experiment.id, 'unknown')).toBeNull();
      });
    });

    describe('getVariantForUser', () => {
      it('should return variant for assigned user', () => {
        assignUser('user-1', experiment.id);
        const variant = getVariantForUser('user-1', experiment.id);

        expect(variant).not.toBeNull();
        expect(['Control', 'Variant']).toContain(variant!.name);
      });

      it('should return null for unassigned user', () => {
        expect(getVariantForUser('unknown', experiment.id)).toBeNull();
      });
    });

    describe('getVariantConfig', () => {
      it('should return merged config', () => {
        assignUser('user-1', experiment.id);
        const config = getVariantConfig<{ color: string; size: string }>(
          'user-1',
          experiment.id,
          { color: 'red', size: 'large' }
        );

        expect(['blue', 'green']).toContain(config.color);
        expect(config.size).toBe('large');
      });

      it('should return default for unassigned user', () => {
        const config = getVariantConfig(
          'unknown',
          experiment.id,
          { color: 'red' }
        );

        expect(config.color).toBe('red');
      });
    });
  });

  describe('Metrics Tracking', () => {
    let experiment: Experiment;
    let variantId: string;

    beforeEach(() => {
      experiment = createExperiment('Test', [
        { name: 'Control', weight: 100, isControl: true, config: {} },
      ]);
      startExperiment(experiment.id);
      variantId = experiment.variants[0].id;
    });

    describe('trackMetric', () => {
      it('should track a metric event', () => {
        const event = trackMetric(experiment.id, variantId, 'user-1', 'impression');

        expect(event).not.toBeNull();
        expect(event!.eventType).toBe('impression');
        expect(event!.value).toBe(1);
      });

      it('should track with custom value', () => {
        const event = trackMetric(experiment.id, variantId, 'user-1', 'conversion', 5);

        expect(event!.value).toBe(5);
      });

      it('should return null for unknown experiment', () => {
        expect(trackMetric('unknown', variantId, 'user-1', 'impression')).toBeNull();
      });
    });

    describe('trackImpression', () => {
      it('should track impression', () => {
        const event = trackImpression(experiment.id, variantId, 'user-1');

        expect(event!.eventType).toBe('impression');
      });
    });

    describe('trackConversion', () => {
      it('should track conversion', () => {
        const event = trackConversion(experiment.id, variantId, 'user-1', 2);

        expect(event!.eventType).toBe('conversion');
        expect(event!.value).toBe(2);
      });
    });

    describe('trackResponseTime', () => {
      it('should track response time', () => {
        const event = trackResponseTime(experiment.id, variantId, 'user-1', 150);

        expect(event!.eventType).toBe('response_time');
        expect(event!.value).toBe(150);
      });
    });

    describe('trackSatisfaction', () => {
      it('should track satisfaction', () => {
        const event = trackSatisfaction(experiment.id, variantId, 'user-1', 4.5);

        expect(event!.eventType).toBe('satisfaction');
        expect(event!.value).toBe(4.5);
      });
    });

    describe('trackError', () => {
      it('should track error', () => {
        const event = trackError(experiment.id, variantId, 'user-1', { code: 'E001' });

        expect(event!.eventType).toBe('error');
        expect(event!.metadata.code).toBe('E001');
      });
    });
  });

  describe('Metrics Aggregation', () => {
    let experiment: Experiment;
    let controlId: string;
    let variantId: string;

    beforeEach(() => {
      experiment = createExperiment('Test', [
        { name: 'Control', weight: 50, isControl: true, config: {} },
        { name: 'Variant', weight: 50, isControl: false, config: {} },
      ]);
      startExperiment(experiment.id);
      controlId = experiment.variants[0].id;
      variantId = experiment.variants[1].id;
    });

    describe('getMetrics', () => {
      it('should aggregate metrics correctly', () => {
        trackImpression(experiment.id, controlId, 'user-1');
        trackImpression(experiment.id, controlId, 'user-2');
        trackConversion(experiment.id, controlId, 'user-1');
        trackResponseTime(experiment.id, controlId, 'user-1', 100);
        trackResponseTime(experiment.id, controlId, 'user-2', 200);
        trackSatisfaction(experiment.id, controlId, 'user-1', 4);
        trackError(experiment.id, controlId, 'user-2');

        const metrics = getMetrics(experiment.id, controlId);

        expect(metrics.impressions).toBe(2);
        expect(metrics.conversions).toBe(1);
        expect(metrics.conversionRate).toBe(0.5);
        expect(metrics.averageResponseTime).toBe(150);
        expect(metrics.satisfactionScore).toBe(4);
        expect(metrics.errorCount).toBe(1);
        expect(metrics.errorRate).toBe(0.5);
      });

      it('should return empty metrics for no data', () => {
        const metrics = getMetrics(experiment.id, controlId);

        expect(metrics.impressions).toBe(0);
        expect(metrics.conversionRate).toBe(0);
      });
    });

    describe('getExperimentMetrics', () => {
      it('should return metrics for all variants', () => {
        trackImpression(experiment.id, controlId, 'user-1');
        trackImpression(experiment.id, variantId, 'user-2');

        const metrics = getExperimentMetrics(experiment.id);

        expect(metrics.length).toBe(2);
      });
    });

    describe('compareVariants', () => {
      it('should compare variants against control', () => {
        // Control: 2 impressions, 1 conversion = 50%
        trackImpression(experiment.id, controlId, 'user-1');
        trackImpression(experiment.id, controlId, 'user-2');
        trackConversion(experiment.id, controlId, 'user-1');

        // Variant: 2 impressions, 2 conversions = 100%
        trackImpression(experiment.id, variantId, 'user-3');
        trackImpression(experiment.id, variantId, 'user-4');
        trackConversion(experiment.id, variantId, 'user-3');
        trackConversion(experiment.id, variantId, 'user-4');

        const comparison = compareVariants(experiment.id);

        expect(comparison).not.toBeNull();
        expect(comparison!.controlMetrics.conversionRate).toBe(0.5);
        expect(comparison!.variantComparisons.length).toBe(1);
        expect(comparison!.variantComparisons[0].conversionLift).toBe(100); // 100% lift
        expect(comparison!.variantComparisons[0].isWinner).toBe(true);
      });
    });
  });

  describe('Targeting', () => {
    describe('evaluateTargeting', () => {
      it('should pass with no rules', () => {
        const experiment = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ]);

        const context: UserContext = {
          userId: 'user-1',
          attributes: {},
        };

        expect(evaluateTargeting(experiment, context)).toBe(true);
      });

      it('should evaluate equals rule', () => {
        const experiment = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ], {
          targetingRules: [
            { field: 'country', operator: 'equals', value: 'US' },
          ],
        });

        expect(evaluateTargeting(experiment, {
          userId: 'user-1',
          attributes: { country: 'US' },
        })).toBe(true);

        expect(evaluateTargeting(experiment, {
          userId: 'user-1',
          attributes: { country: 'UK' },
        })).toBe(false);
      });

      it('should evaluate in rule', () => {
        const experiment = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ], {
          targetingRules: [
            { field: 'plan', operator: 'in', value: ['pro', 'enterprise'] },
          ],
        });

        expect(evaluateTargeting(experiment, {
          userId: 'user-1',
          attributes: { plan: 'pro' },
        })).toBe(true);

        expect(evaluateTargeting(experiment, {
          userId: 'user-1',
          attributes: { plan: 'free' },
        })).toBe(false);
      });

      it('should evaluate greater_than rule', () => {
        const experiment = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ], {
          targetingRules: [
            { field: 'age', operator: 'greater_than', value: 18 },
          ],
        });

        expect(evaluateTargeting(experiment, {
          userId: 'user-1',
          attributes: { age: 25 },
        })).toBe(true);

        expect(evaluateTargeting(experiment, {
          userId: 'user-1',
          attributes: { age: 16 },
        })).toBe(false);
      });

      it('should require all rules to pass', () => {
        const experiment = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ], {
          targetingRules: [
            { field: 'country', operator: 'equals', value: 'US' },
            { field: 'plan', operator: 'equals', value: 'pro' },
          ],
        });

        expect(evaluateTargeting(experiment, {
          userId: 'user-1',
          attributes: { country: 'US', plan: 'pro' },
        })).toBe(true);

        expect(evaluateTargeting(experiment, {
          userId: 'user-1',
          attributes: { country: 'US', plan: 'free' },
        })).toBe(false);
      });
    });
  });

  describe('State and Cleanup', () => {
    describe('getState', () => {
      it('should return current state', () => {
        createExperiment('Test', [{ name: 'C', weight: 100, isControl: true, config: {} }]);

        const currentState = getState();
        expect(currentState.experiments.size).toBe(1);
      });
    });

    describe('getExperimentCount', () => {
      it('should return experiment count', () => {
        createExperiment('Exp 1', [{ name: 'C', weight: 100, isControl: true, config: {} }]);
        createExperiment('Exp 2', [{ name: 'C', weight: 100, isControl: true, config: {} }]);

        expect(getExperimentCount()).toBe(2);
      });
    });

    describe('removeExperiment', () => {
      it('should remove experiment and related data', () => {
        const exp = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ]);
        startExperiment(exp.id);
        assignUser('user-1', exp.id);
        trackImpression(exp.id, exp.variants[0].id, 'user-1');

        expect(removeExperiment(exp.id)).toBe(true);
        expect(getExperiment(exp.id)).toBeNull();
        expect(getAssignment('user-1', exp.id)).toBeNull();
      });

      it('should return false for unknown experiment', () => {
        expect(removeExperiment('unknown')).toBe(false);
      });
    });

    describe('clearAssignments', () => {
      it('should clear assignments for experiment', () => {
        const exp = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ]);
        startExperiment(exp.id);
        assignUser('user-1', exp.id);
        assignUser('user-2', exp.id);

        const cleared = clearAssignments(exp.id);
        expect(cleared).toBe(2);
        expect(getAssignmentCount()).toBe(0);
      });
    });

    describe('clearMetrics', () => {
      it('should clear metrics for experiment', () => {
        const exp = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ]);
        startExperiment(exp.id);
        trackImpression(exp.id, exp.variants[0].id, 'user-1');

        const cleared = clearMetrics(exp.id);
        expect(cleared).toBe(1);
      });
    });
  });

  describe('resetABTesting', () => {
    it('should reset all state', () => {
      const exp = createExperiment('Test', [
        { name: 'C', weight: 100, isControl: true, config: {} },
      ]);
      startExperiment(exp.id);
      assignUser('user-1', exp.id);

      resetABTesting();

      expect(getExperimentCount()).toBe(0);
      expect(getAssignmentCount()).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    describe('formatMetrics', () => {
      it('should format metrics as string', () => {
        const exp = createExperiment('Test', [
          { name: 'C', weight: 100, isControl: true, config: {} },
        ]);
        startExperiment(exp.id);
        trackImpression(exp.id, exp.variants[0].id, 'user-1');
        trackConversion(exp.id, exp.variants[0].id, 'user-1');

        const metrics = getMetrics(exp.id, exp.variants[0].id);
        const formatted = formatMetrics(metrics);

        expect(formatted).toContain('Impressions: 1');
        expect(formatted).toContain('Conversions: 1');
        expect(formatted).toContain('100.0%');
      });
    });
  });

  describe('User Splitting', () => {
    it('should split users between agent versions', () => {
      const experiment = createExperiment('Agent Version Test', [
        { name: 'Agent v1', weight: 50, isControl: true, config: { version: 'v1' } },
        { name: 'Agent v2', weight: 50, isControl: false, config: { version: 'v2' } },
      ]);
      startExperiment(experiment.id);

      const v1Users: string[] = [];
      const v2Users: string[] = [];

      // Assign 100 users
      for (let i = 0; i < 100; i++) {
        const assignment = assignUser(`user-${i}`, experiment.id);
        if (assignment) {
          const variant = getVariant(experiment.id, assignment.variantId);
          if (variant?.name === 'Agent v1') {
            v1Users.push(`user-${i}`);
          } else {
            v2Users.push(`user-${i}`);
          }
        }
      }

      // Should have some users in each variant (not exact 50/50 due to hashing)
      expect(v1Users.length).toBeGreaterThan(0);
      expect(v2Users.length).toBeGreaterThan(0);
    });

    it('should track metrics per variant', () => {
      const experiment = createExperiment('Metrics Test', [
        { name: 'Control', weight: 50, isControl: true, config: {} },
        { name: 'Variant', weight: 50, isControl: false, config: {} },
      ]);
      startExperiment(experiment.id);

      const controlId = experiment.variants[0].id;
      const variantId = experiment.variants[1].id;

      // Track different metrics for each variant
      trackImpression(experiment.id, controlId, 'user-1');
      trackImpression(experiment.id, controlId, 'user-2');
      trackConversion(experiment.id, controlId, 'user-1');

      trackImpression(experiment.id, variantId, 'user-3');
      trackImpression(experiment.id, variantId, 'user-4');
      trackImpression(experiment.id, variantId, 'user-5');
      trackConversion(experiment.id, variantId, 'user-3');
      trackConversion(experiment.id, variantId, 'user-4');

      const controlMetrics = getMetrics(experiment.id, controlId);
      const variantMetrics = getMetrics(experiment.id, variantId);

      expect(controlMetrics.impressions).toBe(2);
      expect(controlMetrics.conversionRate).toBe(0.5);

      expect(variantMetrics.impressions).toBe(3);
      expect(variantMetrics.conversionRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty experiments', () => {
      expect(getAllExperiments()).toEqual([]);
      expect(getRunningExperiments()).toEqual([]);
    });

    it('should handle experiment with single variant', () => {
      const exp = createExperiment('Single', [
        { name: 'Only', weight: 100, isControl: true, config: {} },
      ]);
      startExperiment(exp.id);

      const assignment = assignUser('user-1', exp.id);
      expect(assignment).not.toBeNull();
      expect(assignment!.variantId).toBe(exp.variants[0].id);
    });

    it('should handle zero weight variants', () => {
      const exp = createExperiment('Zero Weight', [
        { name: 'Active', weight: 100, isControl: true, config: {} },
        { name: 'Inactive', weight: 0, isControl: false, config: {} },
      ]);
      startExperiment(exp.id);

      // All users should get the active variant
      for (let i = 0; i < 10; i++) {
        const assignment = assignUser(`user-${i}`, exp.id);
        const variant = getVariant(exp.id, assignment!.variantId);
        expect(variant!.name).toBe('Active');
      }
    });
  });
});
