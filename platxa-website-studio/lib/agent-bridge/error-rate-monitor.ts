/**
 * Error Rate Monitoring with Alerts
 *
 * Monitors error rates over configurable time windows and triggers
 * alerts when thresholds are exceeded. Default: alert if > 20% errors over 1 hour.
 */

// =============================================================================
// Types
// =============================================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface ErrorEvent {
  /** Unique event ID */
  id: string;
  /** Timestamp (ms since epoch) */
  timestamp: number;
  /** Whether this was an error (true) or success (false) */
  isError: boolean;
  /** Error category (if error) */
  category?: string;
  /** Error message (if error) */
  message?: string;
}

export interface AlertConfig {
  /** Alert name */
  name: string;
  /** Error rate threshold (0-1, e.g., 0.2 = 20%) */
  threshold: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Minimum events required in window to trigger */
  minEvents: number;
  /** Alert severity */
  severity: AlertSeverity;
  /** Cooldown period between alerts (ms) */
  cooldownMs: number;
}

export interface Alert {
  /** Unique alert ID */
  id: string;
  /** Alert config name */
  configName: string;
  /** Timestamp when triggered */
  timestamp: number;
  /** Current error rate that triggered alert */
  errorRate: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Time window */
  windowMs: number;
  /** Total events in window */
  totalEvents: number;
  /** Error events in window */
  errorEvents: number;
  /** Alert severity */
  severity: AlertSeverity;
  /** Whether alert has been acknowledged */
  acknowledged: boolean;
}

export interface MonitorConfig {
  /** Alert configurations */
  alerts: AlertConfig[];
  /** Maximum events to keep in memory */
  maxEvents: number;
  /** Check interval (ms) - how often to evaluate alerts */
  checkIntervalMs: number;
}

export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  alerts: [
    {
      name: 'high_error_rate_1h',
      threshold: 0.2, // 20%
      windowMs: 3600000, // 1 hour
      minEvents: 10,
      severity: 'critical',
      cooldownMs: 300000, // 5 minutes
    },
    {
      name: 'elevated_error_rate_15m',
      threshold: 0.15, // 15%
      windowMs: 900000, // 15 minutes
      minEvents: 5,
      severity: 'warning',
      cooldownMs: 180000, // 3 minutes
    },
  ],
  maxEvents: 10000,
  checkIntervalMs: 60000, // 1 minute
};

export interface MonitorState {
  /** Recorded events */
  events: ErrorEvent[];
  /** Triggered alerts */
  alerts: Alert[];
  /** Last alert time per config (for cooldown) */
  lastAlertTime: Map<string, number>;
  /** Event counter */
  eventCounter: number;
  /** Alert counter */
  alertCounter: number;
  /** Configuration */
  config: MonitorConfig;
}

export type AlertCallback = (alert: Alert) => void;

// =============================================================================
// State Management
// =============================================================================

/**
 * Creates initial monitor state.
 */
export function createMonitorState(
  config: Partial<MonitorConfig> = {},
): MonitorState {
  return {
    events: [],
    alerts: [],
    lastAlertTime: new Map(),
    eventCounter: 0,
    alertCounter: 0,
    config: { ...DEFAULT_MONITOR_CONFIG, ...config },
  };
}

/**
 * Records an event (success or error).
 */
export function recordEvent(
  state: MonitorState,
  isError: boolean,
  category?: string,
  message?: string,
  timestamp: number = Date.now(),
): MonitorState {
  const event: ErrorEvent = {
    id: `evt_${++state.eventCounter}`,
    timestamp,
    isError,
    category,
    message,
  };

  let events = [...state.events, event];

  // Trim old events beyond maxEvents
  if (events.length > state.config.maxEvents) {
    events = events.slice(events.length - state.config.maxEvents);
  }

  return { ...state, events, eventCounter: state.eventCounter };
}

/**
 * Records a successful event.
 */
export function recordSuccess(
  state: MonitorState,
  timestamp: number = Date.now(),
): MonitorState {
  return recordEvent(state, false, undefined, undefined, timestamp);
}

/**
 * Records an error event.
 */
export function recordError(
  state: MonitorState,
  category: string,
  message: string,
  timestamp: number = Date.now(),
): MonitorState {
  return recordEvent(state, true, category, message, timestamp);
}

// =============================================================================
// Error Rate Computation
// =============================================================================

/**
 * Computes error rate for a time window.
 */
export function computeErrorRate(
  state: MonitorState,
  windowMs: number,
  now: number = Date.now(),
): { errorRate: number; totalEvents: number; errorEvents: number } {
  const windowStart = now - windowMs;
  const windowEvents = state.events.filter((e) => e.timestamp >= windowStart);
  const totalEvents = windowEvents.length;
  const errorEvents = windowEvents.filter((e) => e.isError).length;

  return {
    errorRate: totalEvents > 0 ? errorEvents / totalEvents : 0,
    totalEvents,
    errorEvents,
  };
}

/**
 * Gets events within a time window.
 */
export function getEventsInWindow(
  state: MonitorState,
  windowMs: number,
  now: number = Date.now(),
): ErrorEvent[] {
  const windowStart = now - windowMs;
  return state.events.filter((e) => e.timestamp >= windowStart);
}

// =============================================================================
// Alert Evaluation
// =============================================================================

/**
 * Checks if an alert should be triggered for a given config.
 */
export function shouldTriggerAlert(
  state: MonitorState,
  alertConfig: AlertConfig,
  now: number = Date.now(),
): { shouldTrigger: boolean; errorRate: number; totalEvents: number; errorEvents: number } {
  const { errorRate, totalEvents, errorEvents } = computeErrorRate(
    state,
    alertConfig.windowMs,
    now,
  );

  // Check minimum events requirement
  if (totalEvents < alertConfig.minEvents) {
    return { shouldTrigger: false, errorRate, totalEvents, errorEvents };
  }

  // Check threshold
  if (errorRate <= alertConfig.threshold) {
    return { shouldTrigger: false, errorRate, totalEvents, errorEvents };
  }

  // Check cooldown
  const lastAlert = state.lastAlertTime.get(alertConfig.name);
  if (lastAlert && now - lastAlert < alertConfig.cooldownMs) {
    return { shouldTrigger: false, errorRate, totalEvents, errorEvents };
  }

  return { shouldTrigger: true, errorRate, totalEvents, errorEvents };
}

/**
 * Evaluates all alert configs and triggers alerts as needed.
 * Returns updated state and any new alerts.
 */
export function evaluateAlerts(
  state: MonitorState,
  now: number = Date.now(),
): { state: MonitorState; newAlerts: Alert[] } {
  const newAlerts: Alert[] = [];
  let updatedState = state;

  for (const alertConfig of state.config.alerts) {
    const { shouldTrigger, errorRate, totalEvents, errorEvents } = shouldTriggerAlert(
      updatedState,
      alertConfig,
      now,
    );

    if (shouldTrigger) {
      const alert: Alert = {
        id: `alert_${++updatedState.alertCounter}`,
        configName: alertConfig.name,
        timestamp: now,
        errorRate,
        threshold: alertConfig.threshold,
        windowMs: alertConfig.windowMs,
        totalEvents,
        errorEvents,
        severity: alertConfig.severity,
        acknowledged: false,
      };

      newAlerts.push(alert);

      // Update state
      const lastAlertTime = new Map(updatedState.lastAlertTime);
      lastAlertTime.set(alertConfig.name, now);

      updatedState = {
        ...updatedState,
        alerts: [...updatedState.alerts, alert],
        lastAlertTime,
        alertCounter: updatedState.alertCounter,
      };
    }
  }

  return { state: updatedState, newAlerts };
}

// =============================================================================
// Alert Management
// =============================================================================

/**
 * Acknowledges an alert.
 */
export function acknowledgeAlert(
  state: MonitorState,
  alertId: string,
): MonitorState {
  const alerts = state.alerts.map((a) =>
    a.id === alertId ? { ...a, acknowledged: true } : a,
  );
  return { ...state, alerts };
}

/**
 * Gets unacknowledged alerts.
 */
export function getActiveAlerts(state: MonitorState): Alert[] {
  return state.alerts.filter((a) => !a.acknowledged);
}

/**
 * Gets alerts by severity.
 */
export function getAlertsBySeverity(
  state: MonitorState,
  severity: AlertSeverity,
): Alert[] {
  return state.alerts.filter((a) => a.severity === severity);
}

/**
 * Gets recent alerts within a time window.
 */
export function getRecentAlerts(
  state: MonitorState,
  windowMs: number,
  now: number = Date.now(),
): Alert[] {
  const windowStart = now - windowMs;
  return state.alerts.filter((a) => a.timestamp >= windowStart);
}

// =============================================================================
// Monitor Summary
// =============================================================================

export interface MonitorSummary {
  /** Current error rate (1 hour window) */
  currentErrorRate: number;
  /** Total events tracked */
  totalEvents: number;
  /** Total errors */
  totalErrors: number;
  /** Active (unacknowledged) alerts */
  activeAlerts: number;
  /** Total alerts triggered */
  totalAlerts: number;
  /** Alerts by severity */
  alertsBySeverity: Record<AlertSeverity, number>;
  /** Error rate by window */
  errorRateByWindow: { window: string; rate: number }[];
  /** Health status */
  healthStatus: 'healthy' | 'degraded' | 'critical';
}

/**
 * Computes monitor summary.
 */
export function computeMonitorSummary(
  state: MonitorState,
  now: number = Date.now(),
): MonitorSummary {
  const rate1h = computeErrorRate(state, 3600000, now);
  const rate15m = computeErrorRate(state, 900000, now);
  const rate5m = computeErrorRate(state, 300000, now);

  const activeAlerts = getActiveAlerts(state);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
  const warningAlerts = activeAlerts.filter((a) => a.severity === 'warning');

  let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (criticalAlerts.length > 0) {
    healthStatus = 'critical';
  } else if (warningAlerts.length > 0 || rate1h.errorRate > 0.1) {
    healthStatus = 'degraded';
  }

  return {
    currentErrorRate: rate1h.errorRate,
    totalEvents: state.events.length,
    totalErrors: state.events.filter((e) => e.isError).length,
    activeAlerts: activeAlerts.length,
    totalAlerts: state.alerts.length,
    alertsBySeverity: {
      info: state.alerts.filter((a) => a.severity === 'info').length,
      warning: state.alerts.filter((a) => a.severity === 'warning').length,
      critical: state.alerts.filter((a) => a.severity === 'critical').length,
    },
    errorRateByWindow: [
      { window: '5m', rate: rate5m.errorRate },
      { window: '15m', rate: rate15m.errorRate },
      { window: '1h', rate: rate1h.errorRate },
    ],
    healthStatus,
  };
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Formats alert for display.
 */
export function formatAlert(alert: Alert): string {
  const severity = alert.severity.toUpperCase();
  const rate = (alert.errorRate * 100).toFixed(1);
  const threshold = (alert.threshold * 100).toFixed(0);
  const window = formatWindow(alert.windowMs);

  return `[${severity}] ${alert.configName}: Error rate ${rate}% exceeds ${threshold}% threshold over ${window} (${alert.errorEvents}/${alert.totalEvents} errors)`;
}

/**
 * Formats time window for display.
 */
export function formatWindow(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

/**
 * Formats monitor summary for display.
 */
export function formatMonitorSummary(summary: MonitorSummary): string {
  const statusEmoji = {
    healthy: '🟢',
    degraded: '🟡',
    critical: '🔴',
  };

  const lines = [
    '═══════════════════════════════════════════════════════════',
    `  ERROR RATE MONITOR  ${statusEmoji[summary.healthStatus]} ${summary.healthStatus.toUpperCase()}`,
    '═══════════════════════════════════════════════════════════',
    '',
    '📊 ERROR RATES',
    ...summary.errorRateByWindow.map(
      (w) => `  ${w.window.padEnd(4)}: ${(w.rate * 100).toFixed(1)}%`,
    ),
    '',
    '🚨 ALERTS',
    `  Active: ${summary.activeAlerts}`,
    `  Total: ${summary.totalAlerts}`,
    `  Critical: ${summary.alertsBySeverity.critical}`,
    `  Warning: ${summary.alertsBySeverity.warning}`,
    '',
    '📈 EVENTS',
    `  Total: ${summary.totalEvents}`,
    `  Errors: ${summary.totalErrors}`,
    '═══════════════════════════════════════════════════════════',
  ];

  return lines.join('\n');
}

// =============================================================================
// Alert Subscription (Simple Observer Pattern)
// =============================================================================

export interface MonitorWithCallbacks {
  state: MonitorState;
  callbacks: Set<AlertCallback>;
}

/**
 * Creates monitor with callback support.
 */
export function createMonitorWithCallbacks(
  config: Partial<MonitorConfig> = {},
): MonitorWithCallbacks {
  return {
    state: createMonitorState(config),
    callbacks: new Set(),
  };
}

/**
 * Subscribes to alerts.
 */
export function subscribeToAlerts(
  monitor: MonitorWithCallbacks,
  callback: AlertCallback,
): void {
  monitor.callbacks.add(callback);
}

/**
 * Unsubscribes from alerts.
 */
export function unsubscribeFromAlerts(
  monitor: MonitorWithCallbacks,
  callback: AlertCallback,
): void {
  monitor.callbacks.delete(callback);
}

/**
 * Records event and evaluates alerts, triggering callbacks.
 */
export function recordAndEvaluate(
  monitor: MonitorWithCallbacks,
  isError: boolean,
  category?: string,
  message?: string,
  now: number = Date.now(),
): MonitorWithCallbacks {
  // Record the event
  let state = recordEvent(monitor.state, isError, category, message, now);

  // Evaluate alerts
  const { state: newState, newAlerts } = evaluateAlerts(state, now);
  state = newState;

  // Trigger callbacks for new alerts
  for (const alert of newAlerts) {
    for (const callback of monitor.callbacks) {
      try {
        callback(alert);
      } catch {
        // Ignore callback errors
      }
    }
  }

  return { ...monitor, state };
}
