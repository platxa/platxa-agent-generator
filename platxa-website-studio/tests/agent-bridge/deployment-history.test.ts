/**
 * Tests for Deployment History Tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDeployment,
  getDeployment,
  getAllDeployments,
  getDeploymentCount,
  startDeployment,
  completeDeployment,
  cancelDeployment,
  rollbackDeployment,
  updateDeploymentUrl,
  logDeploymentEvent,
  getDeploymentEvents,
  getLatestEvent,
  queryDeployments,
  getDeploymentsByEnvironment,
  getDeploymentsByStatus,
  getRecentDeployments,
  getActiveDeployments,
  getSuccessfulDeployments,
  getFailedDeployments,
  getLatestDeployment,
  getLatestSuccessfulDeployment,
  getLatestDeploymentByEnvironment,
  getStats,
  getStatsByEnvironment,
  setMaxDeployments,
  getMaxDeployments,
  updateMetadata,
  updateNotes,
  getDisplayData,
  exportHistory,
  getState,
  removeDeployment,
  clearHistory,
  resetDeploymentHistory,
  isDeploymentActive,
  isDeploymentComplete,
  getDeploymentDuration,
  formatDuration,
  type Deployment,
  type DeploymentStatus,
  type DeploymentEnvironment,
} from '../../lib/agent-bridge/deployment-history';

describe('Deployment History Tracking', () => {
  beforeEach(() => {
    resetDeploymentHistory();
  });

  describe('createDeployment', () => {
    it('should create a deployment with basic info', () => {
      const deployment = createDeployment('1.0.0', 'production', 'user@example.com');

      expect(deployment.id).toBeDefined();
      expect(deployment.version).toBe('1.0.0');
      expect(deployment.environment).toBe('production');
      expect(deployment.initiatedBy).toBe('user@example.com');
      expect(deployment.status).toBe('pending');
      expect(deployment.startedAt).toBeGreaterThan(0);
    });

    it('should create a deployment with options', () => {
      const deployment = createDeployment('1.0.0', 'staging', 'user@example.com', {
        commitHash: 'abc123',
        branch: 'main',
        notes: 'Release notes',
        metadata: { buildId: 'build-123' },
      });

      expect(deployment.commitHash).toBe('abc123');
      expect(deployment.branch).toBe('main');
      expect(deployment.notes).toBe('Release notes');
      expect(deployment.metadata).toEqual({ buildId: 'build-123' });
    });

    it('should generate unique IDs', () => {
      const d1 = createDeployment('1.0.0', 'production', 'user1');
      const d2 = createDeployment('1.0.1', 'production', 'user2');

      expect(d1.id).not.toBe(d2.id);
    });

    it('should increment creation order', () => {
      const d1 = createDeployment('1.0.0', 'production', 'user1');
      const d2 = createDeployment('1.0.1', 'production', 'user2');

      expect(d2.creationOrder).toBeGreaterThan(d1.creationOrder);
    });

    it('should add initial started event', () => {
      const deployment = createDeployment('1.0.0', 'production', 'user');
      const events = getDeploymentEvents(deployment.id);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('started');
    });
  });

  describe('getDeployment', () => {
    it('should return deployment by ID', () => {
      const created = createDeployment('1.0.0', 'production', 'user');
      const retrieved = getDeployment(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for unknown ID', () => {
      expect(getDeployment('unknown')).toBeNull();
    });
  });

  describe('getAllDeployments', () => {
    it('should return empty array initially', () => {
      expect(getAllDeployments()).toEqual([]);
    });

    it('should return deployments sorted by timestamp desc', () => {
      const d1 = createDeployment('1.0.0', 'production', 'user');
      const d2 = createDeployment('1.0.1', 'production', 'user');
      const d3 = createDeployment('1.0.2', 'production', 'user');

      const all = getAllDeployments();

      expect(all[0].id).toBe(d3.id);
      expect(all[1].id).toBe(d2.id);
      expect(all[2].id).toBe(d1.id);
    });
  });

  describe('Status Updates', () => {
    describe('startDeployment', () => {
      it('should start a pending deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        const started = startDeployment(deployment.id);

        expect(started).not.toBeNull();
        expect(started!.status).toBe('in_progress');
      });

      it('should add building event', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);

        const events = getDeploymentEvents(deployment.id);
        expect(events[1].type).toBe('building');
      });

      it('should return null for non-pending deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);

        expect(startDeployment(deployment.id)).toBeNull();
      });

      it('should return null for unknown deployment', () => {
        expect(startDeployment('unknown')).toBeNull();
      });
    });

    describe('completeDeployment', () => {
      it('should complete deployment successfully', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        const completed = completeDeployment(deployment.id, true, 'https://app.example.com');

        expect(completed).not.toBeNull();
        expect(completed!.status).toBe('succeeded');
        expect(completed!.completedAt).toBeGreaterThan(0);
        expect(completed!.duration).toBeGreaterThanOrEqual(0);
        expect(completed!.url).toBe('https://app.example.com');
      });

      it('should complete deployment as failed', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        const completed = completeDeployment(deployment.id, false);

        expect(completed).not.toBeNull();
        expect(completed!.status).toBe('failed');
      });

      it('should add appropriate event', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        completeDeployment(deployment.id, true);

        const latest = getLatestEvent(deployment.id);
        expect(latest!.type).toBe('completed');
      });

      it('should return null for unknown deployment', () => {
        expect(completeDeployment('unknown', true)).toBeNull();
      });
    });

    describe('cancelDeployment', () => {
      it('should cancel pending deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        const cancelled = cancelDeployment(deployment.id, 'User requested');

        expect(cancelled).not.toBeNull();
        expect(cancelled!.status).toBe('cancelled');
        expect(cancelled!.completedAt).toBeGreaterThan(0);
      });

      it('should cancel in-progress deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        const cancelled = cancelDeployment(deployment.id);

        expect(cancelled).not.toBeNull();
        expect(cancelled!.status).toBe('cancelled');
      });

      it('should return null for completed deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        completeDeployment(deployment.id, true);

        expect(cancelDeployment(deployment.id)).toBeNull();
      });
    });

    describe('rollbackDeployment', () => {
      it('should rollback successful deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        completeDeployment(deployment.id, true);
        const rolledBack = rollbackDeployment(deployment.id, 'Found bug');

        expect(rolledBack).not.toBeNull();
        expect(rolledBack!.status).toBe('rolled_back');
      });

      it('should return null for non-successful deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);

        expect(rollbackDeployment(deployment.id)).toBeNull();
      });
    });

    describe('updateDeploymentUrl', () => {
      it('should update deployment URL', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        const updated = updateDeploymentUrl(deployment.id, 'https://new-url.com');

        expect(updated).not.toBeNull();
        expect(updated!.url).toBe('https://new-url.com');
      });

      it('should return null for unknown deployment', () => {
        expect(updateDeploymentUrl('unknown', 'https://url.com')).toBeNull();
      });
    });
  });

  describe('Events', () => {
    describe('logDeploymentEvent', () => {
      it('should log custom event', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        const event = logDeploymentEvent(deployment.id, 'deploying', 'Deploying to server');

        expect(event).not.toBeNull();
        expect(event!.type).toBe('deploying');
        expect(event!.message).toBe('Deploying to server');
      });

      it('should log event with details', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        const event = logDeploymentEvent(
          deployment.id,
          'verifying',
          'Running health checks',
          { checksPassed: 5 }
        );

        expect(event!.details).toEqual({ checksPassed: 5 });
      });

      it('should return null for unknown deployment', () => {
        expect(logDeploymentEvent('unknown', 'deploying', 'Test')).toBeNull();
      });
    });

    describe('getDeploymentEvents', () => {
      it('should return all events for deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        logDeploymentEvent(deployment.id, 'deploying', 'Deploying');
        completeDeployment(deployment.id, true);

        const events = getDeploymentEvents(deployment.id);

        expect(events.length).toBe(4);
      });

      it('should return empty array for unknown deployment', () => {
        expect(getDeploymentEvents('unknown')).toEqual([]);
      });
    });

    describe('getLatestEvent', () => {
      it('should return latest event', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);

        const latest = getLatestEvent(deployment.id);

        expect(latest).not.toBeNull();
        expect(latest!.type).toBe('building');
      });

      it('should return null for unknown deployment', () => {
        expect(getLatestEvent('unknown')).toBeNull();
      });
    });
  });

  describe('Query Functions', () => {
    beforeEach(() => {
      const d1 = createDeployment('1.0.0', 'production', 'user1', { branch: 'main' });
      startDeployment(d1.id);
      completeDeployment(d1.id, true);

      const d2 = createDeployment('1.0.1', 'staging', 'user2', { branch: 'develop' });
      startDeployment(d2.id);
      completeDeployment(d2.id, false);

      createDeployment('1.0.2', 'production', 'user1', { branch: 'main' });
    });

    describe('queryDeployments', () => {
      it('should filter by environment', () => {
        const results = queryDeployments({ environment: 'production' });
        expect(results.length).toBe(2);
      });

      it('should filter by status', () => {
        const results = queryDeployments({ status: 'succeeded' });
        expect(results.length).toBe(1);
      });

      it('should filter by initiatedBy', () => {
        const results = queryDeployments({ initiatedBy: 'user1' });
        expect(results.length).toBe(2);
      });

      it('should filter by branch', () => {
        const results = queryDeployments({ branch: 'main' });
        expect(results.length).toBe(2);
      });

      it('should limit results', () => {
        const results = queryDeployments({ limit: 2 });
        expect(results.length).toBe(2);
      });
    });

    describe('getDeploymentsByEnvironment', () => {
      it('should return deployments for environment', () => {
        const results = getDeploymentsByEnvironment('staging');
        expect(results.length).toBe(1);
      });
    });

    describe('getDeploymentsByStatus', () => {
      it('should return deployments by status', () => {
        const pending = getDeploymentsByStatus('pending');
        expect(pending.length).toBe(1);

        const failed = getDeploymentsByStatus('failed');
        expect(failed.length).toBe(1);
      });
    });

    describe('getRecentDeployments', () => {
      it('should return recent deployments', () => {
        const recent = getRecentDeployments(2);
        expect(recent.length).toBe(2);
      });
    });

    describe('getActiveDeployments', () => {
      it('should return active deployments', () => {
        const active = getActiveDeployments();
        expect(active.length).toBe(1);
        expect(active[0].status).toBe('pending');
      });
    });

    describe('getSuccessfulDeployments', () => {
      it('should return successful deployments', () => {
        const successful = getSuccessfulDeployments();
        expect(successful.length).toBe(1);
      });
    });

    describe('getFailedDeployments', () => {
      it('should return failed deployments', () => {
        const failed = getFailedDeployments();
        expect(failed.length).toBe(1);
      });
    });
  });

  describe('Latest Deployments', () => {
    beforeEach(() => {
      const d1 = createDeployment('1.0.0', 'production', 'user');
      startDeployment(d1.id);
      completeDeployment(d1.id, true);

      const d2 = createDeployment('1.0.1', 'staging', 'user');
      startDeployment(d2.id);
      completeDeployment(d2.id, true);

      createDeployment('1.0.2', 'production', 'user');
    });

    describe('getLatestDeployment', () => {
      it('should return most recent deployment', () => {
        const latest = getLatestDeployment();
        expect(latest).not.toBeNull();
        expect(latest!.version).toBe('1.0.2');
      });

      it('should return null when no deployments', () => {
        resetDeploymentHistory();
        expect(getLatestDeployment()).toBeNull();
      });
    });

    describe('getLatestSuccessfulDeployment', () => {
      it('should return latest successful deployment', () => {
        const latest = getLatestSuccessfulDeployment();
        expect(latest).not.toBeNull();
        expect(latest!.version).toBe('1.0.1');
      });

      it('should filter by environment', () => {
        const latest = getLatestSuccessfulDeployment('production');
        expect(latest).not.toBeNull();
        expect(latest!.version).toBe('1.0.0');
      });
    });

    describe('getLatestDeploymentByEnvironment', () => {
      it('should return latest for environment', () => {
        const latest = getLatestDeploymentByEnvironment('production');
        expect(latest).not.toBeNull();
        expect(latest!.version).toBe('1.0.2');
      });
    });
  });

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return empty stats initially', () => {
        const stats = getStats();

        expect(stats.totalDeployments).toBe(0);
        expect(stats.successCount).toBe(0);
        expect(stats.failedCount).toBe(0);
        expect(stats.successRate).toBe(0);
        expect(stats.averageDuration).toBe(0);
        expect(stats.lastDeployment).toBeNull();
      });

      it('should calculate correct stats', () => {
        const d1 = createDeployment('1.0.0', 'production', 'user');
        startDeployment(d1.id);
        completeDeployment(d1.id, true);

        const d2 = createDeployment('1.0.1', 'production', 'user');
        startDeployment(d2.id);
        completeDeployment(d2.id, false);

        const stats = getStats();

        expect(stats.totalDeployments).toBe(2);
        expect(stats.successCount).toBe(1);
        expect(stats.failedCount).toBe(1);
        expect(stats.successRate).toBe(0.5);
        expect(stats.lastDeployment).not.toBeNull();
      });

      it('should count deployments today', () => {
        createDeployment('1.0.0', 'production', 'user');
        createDeployment('1.0.1', 'production', 'user');

        const stats = getStats();
        expect(stats.deploymentsToday).toBe(2);
      });
    });

    describe('getStatsByEnvironment', () => {
      it('should return stats for specific environment', () => {
        const d1 = createDeployment('1.0.0', 'production', 'user');
        startDeployment(d1.id);
        completeDeployment(d1.id, true);

        const d2 = createDeployment('1.0.1', 'staging', 'user');
        startDeployment(d2.id);
        completeDeployment(d2.id, true);

        const prodStats = getStatsByEnvironment('production');
        expect(prodStats.totalDeployments).toBe(1);

        const stagingStats = getStatsByEnvironment('staging');
        expect(stagingStats.totalDeployments).toBe(1);
      });
    });
  });

  describe('Retention', () => {
    describe('setMaxDeployments / getMaxDeployments', () => {
      it('should set and get max deployments', () => {
        setMaxDeployments(50);
        expect(getMaxDeployments()).toBe(50);
      });

      it('should enforce minimum of 1', () => {
        setMaxDeployments(0);
        expect(getMaxDeployments()).toBe(1);
      });

      it('should enforce max on set', () => {
        for (let i = 0; i < 10; i++) {
          createDeployment(`1.0.${i}`, 'production', 'user');
        }

        setMaxDeployments(5);
        expect(getDeploymentCount()).toBe(5);
      });
    });
  });

  describe('Metadata', () => {
    describe('updateMetadata', () => {
      it('should update metadata', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        const updated = updateMetadata(deployment.id, { buildNumber: 123 });

        expect(updated).not.toBeNull();
        expect(updated!.metadata.buildNumber).toBe(123);
      });

      it('should merge with existing metadata', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user', {
          metadata: { existing: 'value' },
        });
        const updated = updateMetadata(deployment.id, { new: 'data' });

        expect(updated!.metadata.existing).toBe('value');
        expect(updated!.metadata.new).toBe('data');
      });

      it('should return null for unknown deployment', () => {
        expect(updateMetadata('unknown', {})).toBeNull();
      });
    });

    describe('updateNotes', () => {
      it('should update notes', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        const updated = updateNotes(deployment.id, 'Updated notes');

        expect(updated).not.toBeNull();
        expect(updated!.notes).toBe('Updated notes');
      });

      it('should return null for unknown deployment', () => {
        expect(updateNotes('unknown', 'notes')).toBeNull();
      });
    });
  });

  describe('Export and Display', () => {
    describe('getDisplayData', () => {
      it('should return display data', () => {
        createDeployment('1.0.0', 'production', 'user');
        createDeployment('1.0.1', 'production', 'user');

        const data = getDisplayData();

        expect(data.deployments.length).toBe(2);
        expect(data.stats.totalDeployments).toBe(2);
        expect(data.activeCount).toBe(2);
      });
    });

    describe('exportHistory', () => {
      it('should export history as JSON', () => {
        createDeployment('1.0.0', 'production', 'user');

        const exported = exportHistory();
        const parsed = JSON.parse(exported);

        expect(parsed.exportedAt).toBeGreaterThan(0);
        expect(parsed.deployments.length).toBe(1);
        expect(parsed.stats.totalDeployments).toBe(1);
      });
    });

    describe('getState', () => {
      it('should return current state', () => {
        createDeployment('1.0.0', 'production', 'user');

        const currentState = getState();

        expect(currentState.deployments.size).toBe(1);
        expect(currentState.maxDeployments).toBeGreaterThan(0);
      });
    });
  });

  describe('Remove and Clear', () => {
    describe('removeDeployment', () => {
      it('should remove deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        expect(removeDeployment(deployment.id)).toBe(true);
        expect(getDeployment(deployment.id)).toBeNull();
        expect(getDeploymentEvents(deployment.id)).toEqual([]);
      });

      it('should return false for unknown deployment', () => {
        expect(removeDeployment('unknown')).toBe(false);
      });
    });

    describe('clearHistory', () => {
      it('should clear all deployments and events', () => {
        createDeployment('1.0.0', 'production', 'user');
        createDeployment('1.0.1', 'production', 'user');

        clearHistory();

        expect(getDeploymentCount()).toBe(0);
      });

      it('should preserve settings', () => {
        setMaxDeployments(50);
        clearHistory();

        expect(getMaxDeployments()).toBe(50);
      });
    });
  });

  describe('resetDeploymentHistory', () => {
    it('should reset to defaults', () => {
      createDeployment('1.0.0', 'production', 'user');
      setMaxDeployments(50);

      resetDeploymentHistory();

      expect(getDeploymentCount()).toBe(0);
      expect(getMaxDeployments()).toBe(100);
    });
  });

  describe('Utility Functions', () => {
    describe('isDeploymentActive', () => {
      it('should return true for pending deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        expect(isDeploymentActive(deployment)).toBe(true);
      });

      it('should return true for in_progress deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        const updated = getDeployment(deployment.id)!;
        expect(isDeploymentActive(updated)).toBe(true);
      });

      it('should return false for completed deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        completeDeployment(deployment.id, true);
        const updated = getDeployment(deployment.id)!;
        expect(isDeploymentActive(updated)).toBe(false);
      });
    });

    describe('isDeploymentComplete', () => {
      it('should return true for succeeded deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        completeDeployment(deployment.id, true);
        const updated = getDeployment(deployment.id)!;
        expect(isDeploymentComplete(updated)).toBe(true);
      });

      it('should return true for failed deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        completeDeployment(deployment.id, false);
        const updated = getDeployment(deployment.id)!;
        expect(isDeploymentComplete(updated)).toBe(true);
      });

      it('should return false for pending deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        expect(isDeploymentComplete(deployment)).toBe(false);
      });
    });

    describe('getDeploymentDuration', () => {
      it('should return duration if set', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        startDeployment(deployment.id);
        completeDeployment(deployment.id, true);
        const updated = getDeployment(deployment.id)!;

        expect(getDeploymentDuration(updated)).toBeGreaterThanOrEqual(0);
      });

      it('should calculate elapsed time for active deployment', () => {
        const deployment = createDeployment('1.0.0', 'production', 'user');
        const duration = getDeploymentDuration(deployment);

        expect(duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('formatDuration', () => {
      it('should format milliseconds', () => {
        expect(formatDuration(500)).toBe('500ms');
      });

      it('should format seconds', () => {
        expect(formatDuration(5000)).toBe('5s');
      });

      it('should format minutes and seconds', () => {
        expect(formatDuration(90000)).toBe('1m 30s');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty history', () => {
      expect(getAllDeployments()).toEqual([]);
      expect(getStats().totalDeployments).toBe(0);
      expect(getLatestDeployment()).toBeNull();
    });

    it('should handle concurrent deployments', () => {
      createDeployment('1.0.0', 'production', 'user1');
      createDeployment('1.0.1', 'staging', 'user2');
      createDeployment('1.0.2', 'development', 'user3');

      const active = getActiveDeployments();
      expect(active.length).toBe(3);
    });

    it('should enforce max deployments automatically', () => {
      setMaxDeployments(5);

      for (let i = 0; i < 10; i++) {
        createDeployment(`1.0.${i}`, 'production', 'user');
      }

      expect(getDeploymentCount()).toBe(5);

      // Should keep most recent
      const all = getAllDeployments();
      expect(all[0].version).toBe('1.0.9');
    });

    it('should handle empty export', () => {
      const exported = exportHistory();
      const parsed = JSON.parse(exported);

      expect(parsed.deployments).toEqual([]);
      expect(parsed.stats.totalDeployments).toBe(0);
    });
  });
});
