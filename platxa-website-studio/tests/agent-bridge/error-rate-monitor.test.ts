/**
 * Error Rate Monitor Tests (Feature #191)
 *
 * Tests for: error rate monitoring with alerts
 * Verification: Alert triggered if error rate > 20% over 1 hour
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMonitorState,
  recordEvent,
  recordSuccess,
  recordError,
  computeErrorRate,
  getEventsInWindow,
  shouldTriggerAlert,
  evaluateAlerts,
  acknowledgeAlert,
  getActiveAlerts,
  getAlertsBySeverity,
  getRecentAlerts,
  computeMonitorSummary,
  formatAlert,
  formatWindow,
  formatMonitorSummary,
  createMonitorWithCallbacks,
  subscribeToAlerts,
  unsubscribeFromAlerts,
  recordAndEvaluate,
  DEFAULT_MONITOR_CONFIG,
  type MonitorState,
  type AlertConfig,
  type Alert,
} from '@/lib/agent-bridge/error-rate-monitor';

describe('Error Rate Monitor (Feature #191)', () => {
  // ===========================================================================
  // State Management
  // ===========================================================================

  describe('createMonitorState', () => {
    it('creates empty state with default config', () => {
      const state = createMonitorState();

      expect(state.events).toHaveLength(0);
      expect(state.alerts).toHaveLength(0);
      expect(state.config.alerts).toHaveLength(2);
    });

    it('accepts custom config', () => {
      const state = createMonitorState({
        maxEvents: 500,
        checkIntervalMs: 30000,
      });

      expect(state.config.maxEvents).toBe(500);
      expect(state.config.checkIntervalMs).toBe(30000);
    });
  });

  describe('recordEvent', () => {
    it('records success event', () => {
      let state = createMonitorState();
      state = recordSuccess(state, 1000);

      expect(state.events).toHaveLength(1);
      expect(state.events[0].isError).toBe(false);
      expect(state.events[0].timestamp).toBe(1000);
    });

    it('records error event', () => {
      let state = createMonitorState();
      state = recordError(state, 'api_error', 'Connection failed', 2000);

      expect(state.events).toHaveLength(1);
      expect(state.events[0].isError).toBe(true);
      expect(state.events[0].category).toBe('api_error');
      expect(state.events[0].message).toBe('Connection failed');
    });

    it('trims events beyond maxEvents', () => {
      let state = createMonitorState({ maxEvents: 5 });

      for (let i = 0; i < 10; i++) {
        state = recordSuccess(state, i * 1000);
      }

      expect(state.events).toHaveLength(5);
      expect(state.events[0].timestamp).toBe(5000);
    });

    it('assigns unique IDs', () => {
      let state = createMonitorState();
      state = recordSuccess(state);
      state = recordError(state, 'test', 'error');

      expect(state.events[0].id).not.toBe(state.events[1].id);
    });
  });

  // ===========================================================================
  // Error Rate Computation
  // ===========================================================================

  describe('computeErrorRate', () => {
    it('returns 0 for empty state', () => {
      const state = createMonitorState();
      const { errorRate, totalEvents, errorEvents } = computeErrorRate(state, 3600000);

      expect(errorRate).toBe(0);
      expect(totalEvents).toBe(0);
      expect(errorEvents).toBe(0);
    });

    it('computes correct error rate', () => {
      let state = createMonitorState();
      const now = 10000;

      // 8 successes, 2 errors = 20% error rate
      for (let i = 0; i < 8; i++) {
        state = recordSuccess(state, now - 1000);
      }
      for (let i = 0; i < 2; i++) {
        state = recordError(state, 'test', 'error', now - 1000);
      }

      const { errorRate, totalEvents, errorEvents } = computeErrorRate(state, 3600000, now);

      expect(totalEvents).toBe(10);
      expect(errorEvents).toBe(2);
      expect(errorRate).toBe(0.2);
    });

    it('only includes events within window', () => {
      let state = createMonitorState();
      const now = 10000;

      // Old event (outside window)
      state = recordError(state, 'test', 'old error', 0);

      // Recent events (inside window)
      state = recordSuccess(state, now - 1000);
      state = recordSuccess(state, now - 500);

      const { errorRate, totalEvents } = computeErrorRate(state, 5000, now);

      expect(totalEvents).toBe(2);
      expect(errorRate).toBe(0);
    });
  });

  describe('getEventsInWindow', () => {
    it('filters events by time window', () => {
      let state = createMonitorState();
      const now = 10000;

      state = recordSuccess(state, 1000); // Outside window
      state = recordSuccess(state, 8000); // Inside window
      state = recordError(state, 'test', 'error', 9000); // Inside window

      const events = getEventsInWindow(state, 5000, now);

      expect(events).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Alert Evaluation
  // ===========================================================================

  describe('shouldTriggerAlert', () => {
    const alertConfig: AlertConfig = {
      name: 'test_alert',
      threshold: 0.2,
      windowMs: 3600000,
      minEvents: 5,
      severity: 'critical',
      cooldownMs: 300000,
    };

    it('returns false when below threshold', () => {
      let state = createMonitorState();
      const now = 10000;

      // 10% error rate (below 20% threshold)
      for (let i = 0; i < 9; i++) {
        state = recordSuccess(state, now - 1000);
      }
      state = recordError(state, 'test', 'error', now - 1000);

      const { shouldTrigger, errorRate } = shouldTriggerAlert(state, alertConfig, now);

      expect(shouldTrigger).toBe(false);
      expect(errorRate).toBe(0.1);
    });

    it('returns false when not enough events', () => {
      let state = createMonitorState();
      const now = 10000;

      // 50% error rate but only 4 events (below minEvents of 5)
      state = recordSuccess(state, now - 1000);
      state = recordSuccess(state, now - 1000);
      state = recordError(state, 'test', 'error', now - 1000);
      state = recordError(state, 'test', 'error', now - 1000);

      const { shouldTrigger } = shouldTriggerAlert(state, alertConfig, now);

      expect(shouldTrigger).toBe(false);
    });

    it('returns true when threshold exceeded with enough events', () => {
      let state = createMonitorState();
      const now = 10000;

      // 30% error rate with 10 events
      for (let i = 0; i < 7; i++) {
        state = recordSuccess(state, now - 1000);
      }
      for (let i = 0; i < 3; i++) {
        state = recordError(state, 'test', 'error', now - 1000);
      }

      const { shouldTrigger, errorRate } = shouldTriggerAlert(state, alertConfig, now);

      expect(shouldTrigger).toBe(true);
      expect(errorRate).toBe(0.3);
    });

    it('respects cooldown period', () => {
      let state = createMonitorState();
      const now = 10000;

      // Set last alert time within cooldown
      state.lastAlertTime.set('test_alert', now - 100000); // 100s ago (within 5m cooldown)

      // 30% error rate with 10 events
      for (let i = 0; i < 7; i++) {
        state = recordSuccess(state, now - 1000);
      }
      for (let i = 0; i < 3; i++) {
        state = recordError(state, 'test', 'error', now - 1000);
      }

      const { shouldTrigger } = shouldTriggerAlert(state, alertConfig, now);

      expect(shouldTrigger).toBe(false);
    });
  });

  describe('evaluateAlerts', () => {
    it('triggers alert when threshold exceeded', () => {
      let state = createMonitorState({
        alerts: [{
          name: 'high_error_rate_1h',
          threshold: 0.2,
          windowMs: 3600000,
          minEvents: 5,
          severity: 'critical',
          cooldownMs: 300000,
        }],
      });
      const now = 10000;

      // 30% error rate
      for (let i = 0; i < 7; i++) {
        state = recordSuccess(state, now - 1000);
      }
      for (let i = 0; i < 3; i++) {
        state = recordError(state, 'test', 'error', now - 1000);
      }

      const { state: newState, newAlerts } = evaluateAlerts(state, now);

      expect(newAlerts).toHaveLength(1);
      expect(newAlerts[0].configName).toBe('high_error_rate_1h');
      expect(newAlerts[0].errorRate).toBe(0.3);
      expect(newAlerts[0].severity).toBe('critical');
      expect(newState.alerts).toHaveLength(1);
    });

    it('does not trigger duplicate alerts within cooldown', () => {
      let state = createMonitorState({
        alerts: [{
          name: 'test_alert',
          threshold: 0.2,
          windowMs: 3600000,
          minEvents: 5,
          severity: 'critical',
          cooldownMs: 300000,
        }],
      });
      const now = 10000;

      // 30% error rate
      for (let i = 0; i < 7; i++) {
        state = recordSuccess(state, now - 1000);
      }
      for (let i = 0; i < 3; i++) {
        state = recordError(state, 'test', 'error', now - 1000);
      }

      // First evaluation
      const { state: state1 } = evaluateAlerts(state, now);
      expect(state1.alerts).toHaveLength(1);

      // Second evaluation (within cooldown)
      const { state: state2, newAlerts } = evaluateAlerts(state1, now + 1000);
      expect(newAlerts).toHaveLength(0);
      expect(state2.alerts).toHaveLength(1);
    });
  });

  // ===========================================================================
  // VERIFICATION: Alert triggered if error rate > 20% over 1 hour
  // ===========================================================================

  describe('VERIFICATION: Alert on > 20% error rate over 1 hour', () => {
    it('triggers alert when error rate exceeds 20% over 1 hour window', () => {
      // Use default config which has 20% threshold for 1 hour
      let state = createMonitorState();
      const now = Date.now();
      const hourAgo = now - 3600000;

      // Create events within the last hour: 75 successes, 25 errors = 25% error rate
      for (let i = 0; i < 75; i++) {
        state = recordSuccess(state, hourAgo + (i * 40000)); // Spread over the hour
      }
      for (let i = 0; i < 25; i++) {
        state = recordError(state, 'api_error', 'Failed', hourAgo + (i * 40000));
      }

      const { newAlerts } = evaluateAlerts(state, now);

      // Should trigger the high_error_rate_1h alert
      const criticalAlert = newAlerts.find(a => a.configName === 'high_error_rate_1h');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert!.errorRate).toBeCloseTo(0.25, 2);
      expect(criticalAlert!.threshold).toBe(0.2);
      expect(criticalAlert!.severity).toBe('critical');
    });

    it('does NOT trigger alert when error rate is exactly 20%', () => {
      let state = createMonitorState();
      const now = Date.now();

      // 80 successes, 20 errors = exactly 20% (not > 20%)
      for (let i = 0; i < 80; i++) {
        state = recordSuccess(state, now - 1000);
      }
      for (let i = 0; i < 20; i++) {
        state = recordError(state, 'test', 'error', now - 1000);
      }

      const { newAlerts } = evaluateAlerts(state, now);
      const criticalAlert = newAlerts.find(a => a.configName === 'high_error_rate_1h');

      expect(criticalAlert).toBeUndefined();
    });

    it('does NOT trigger alert when error rate is 19%', () => {
      let state = createMonitorState();
      const now = Date.now();

      // 81 successes, 19 errors = 19%
      for (let i = 0; i < 81; i++) {
        state = recordSuccess(state, now - 1000);
      }
      for (let i = 0; i < 19; i++) {
        state = recordError(state, 'test', 'error', now - 1000);
      }

      const { newAlerts } = evaluateAlerts(state, now);
      const criticalAlert = newAlerts.find(a => a.configName === 'high_error_rate_1h');

      expect(criticalAlert).toBeUndefined();
    });
  });

  // ===========================================================================
  // Alert Management
  // ===========================================================================

  describe('acknowledgeAlert', () => {
    it('marks alert as acknowledged', () => {
      let state = createMonitorState();
      state = {
        ...state,
        alerts: [{
          id: 'alert_1',
          configName: 'test',
          timestamp: 1000,
          errorRate: 0.3,
          threshold: 0.2,
          windowMs: 3600000,
          totalEvents: 10,
          errorEvents: 3,
          severity: 'critical',
          acknowledged: false,
        }],
      };

      state = acknowledgeAlert(state, 'alert_1');

      expect(state.alerts[0].acknowledged).toBe(true);
    });
  });

  describe('getActiveAlerts', () => {
    it('returns only unacknowledged alerts', () => {
      const state: MonitorState = {
        ...createMonitorState(),
        alerts: [
          { id: 'a1', acknowledged: false } as Alert,
          { id: 'a2', acknowledged: true } as Alert,
          { id: 'a3', acknowledged: false } as Alert,
        ],
      };

      const active = getActiveAlerts(state);

      expect(active).toHaveLength(2);
      expect(active.map(a => a.id)).toEqual(['a1', 'a3']);
    });
  });

  describe('getAlertsBySeverity', () => {
    it('filters alerts by severity', () => {
      const state: MonitorState = {
        ...createMonitorState(),
        alerts: [
          { id: 'a1', severity: 'critical' } as Alert,
          { id: 'a2', severity: 'warning' } as Alert,
          { id: 'a3', severity: 'critical' } as Alert,
        ],
      };

      const critical = getAlertsBySeverity(state, 'critical');

      expect(critical).toHaveLength(2);
    });
  });

  describe('getRecentAlerts', () => {
    it('returns alerts within time window', () => {
      const now = 10000;
      const state: MonitorState = {
        ...createMonitorState(),
        alerts: [
          { id: 'a1', timestamp: 1000 } as Alert, // Old
          { id: 'a2', timestamp: 8000 } as Alert, // Recent
          { id: 'a3', timestamp: 9000 } as Alert, // Recent
        ],
      };

      const recent = getRecentAlerts(state, 5000, now);

      expect(recent).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Monitor Summary
  // ===========================================================================

  describe('computeMonitorSummary', () => {
    it('computes comprehensive summary', () => {
      let state = createMonitorState();
      const now = Date.now();

      // Add some events
      for (let i = 0; i < 8; i++) {
        state = recordSuccess(state, now - 1000);
      }
      for (let i = 0; i < 2; i++) {
        state = recordError(state, 'test', 'error', now - 1000);
      }

      const summary = computeMonitorSummary(state, now);

      expect(summary.totalEvents).toBe(10);
      expect(summary.totalErrors).toBe(2);
      expect(summary.currentErrorRate).toBe(0.2);
      expect(summary.errorRateByWindow).toHaveLength(3);
    });

    it('determines health status correctly', () => {
      let state = createMonitorState();
      const now = Date.now();

      // Healthy state
      for (let i = 0; i < 100; i++) {
        state = recordSuccess(state, now - 1000);
      }

      let summary = computeMonitorSummary(state, now);
      expect(summary.healthStatus).toBe('healthy');

      // Add critical alert
      state = {
        ...state,
        alerts: [{
          id: 'a1',
          severity: 'critical',
          acknowledged: false,
        } as Alert],
      };

      summary = computeMonitorSummary(state, now);
      expect(summary.healthStatus).toBe('critical');
    });
  });

  // ===========================================================================
  // Formatting
  // ===========================================================================

  describe('formatAlert', () => {
    it('formats alert message', () => {
      const alert: Alert = {
        id: 'alert_1',
        configName: 'high_error_rate',
        timestamp: Date.now(),
        errorRate: 0.25,
        threshold: 0.2,
        windowMs: 3600000,
        totalEvents: 100,
        errorEvents: 25,
        severity: 'critical',
        acknowledged: false,
      };

      const formatted = formatAlert(alert);

      expect(formatted).toContain('CRITICAL');
      expect(formatted).toContain('25.0%');
      expect(formatted).toContain('20%');
      expect(formatted).toContain('1h');
      expect(formatted).toContain('25/100');
    });
  });

  describe('formatWindow', () => {
    it('formats seconds', () => {
      expect(formatWindow(30000)).toBe('30s');
    });

    it('formats minutes', () => {
      expect(formatWindow(900000)).toBe('15m');
    });

    it('formats hours', () => {
      expect(formatWindow(3600000)).toBe('1h');
    });
  });

  describe('formatMonitorSummary', () => {
    it('formats summary with all sections', () => {
      let state = createMonitorState();
      state = recordSuccess(state);
      const summary = computeMonitorSummary(state);

      const formatted = formatMonitorSummary(summary);

      expect(formatted).toContain('ERROR RATE MONITOR');
      expect(formatted).toContain('ERROR RATES');
      expect(formatted).toContain('ALERTS');
      expect(formatted).toContain('EVENTS');
    });
  });

  // ===========================================================================
  // Callback Subscription
  // ===========================================================================

  describe('createMonitorWithCallbacks', () => {
    it('creates monitor with callback support', () => {
      const monitor = createMonitorWithCallbacks();

      expect(monitor.state.events).toHaveLength(0);
      expect(monitor.callbacks.size).toBe(0);
    });
  });

  describe('subscribeToAlerts / unsubscribeFromAlerts', () => {
    it('adds and removes callbacks', () => {
      const monitor = createMonitorWithCallbacks();
      const callback = vi.fn();

      subscribeToAlerts(monitor, callback);
      expect(monitor.callbacks.size).toBe(1);

      unsubscribeFromAlerts(monitor, callback);
      expect(monitor.callbacks.size).toBe(0);
    });
  });

  describe('recordAndEvaluate', () => {
    it('triggers callbacks when alert fires', () => {
      let monitor = createMonitorWithCallbacks({
        alerts: [{
          name: 'test_alert',
          threshold: 0.2,
          windowMs: 3600000,
          minEvents: 5,
          severity: 'critical',
          cooldownMs: 0, // No cooldown for test
        }],
      });
      const callback = vi.fn();
      const now = Date.now();

      subscribeToAlerts(monitor, callback);

      // Add events to trigger alert
      for (let i = 0; i < 7; i++) {
        monitor = recordAndEvaluate(monitor, false, undefined, undefined, now);
      }
      for (let i = 0; i < 3; i++) {
        monitor = recordAndEvaluate(monitor, true, 'test', 'error', now);
      }

      expect(callback).toHaveBeenCalled();
      const alert = callback.mock.calls[0][0];
      expect(alert.configName).toBe('test_alert');
    });

    it('handles callback errors gracefully', () => {
      let monitor = createMonitorWithCallbacks({
        alerts: [{
          name: 'test_alert',
          threshold: 0.1,
          windowMs: 3600000,
          minEvents: 2,
          severity: 'critical',
          cooldownMs: 0,
        }],
      });
      const now = Date.now();

      const badCallback = () => {
        throw new Error('Callback error');
      };
      subscribeToAlerts(monitor, badCallback);

      // Should not throw
      expect(() => {
        monitor = recordAndEvaluate(monitor, true, 'test', 'error', now);
        monitor = recordAndEvaluate(monitor, true, 'test', 'error', now);
      }).not.toThrow();
    });
  });
});
