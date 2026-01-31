/**
 * Error Report for Debugging Support
 *
 * Creates comprehensive error reports including error details, context,
 * attempted fixes, and timestamps for debugging support.
 */

// ============================================================================
// Types
// ============================================================================

export interface ErrorReport {
  readonly id: string;
  readonly error: ErrorDetails;
  readonly context: ErrorContext;
  readonly attemptedFixes: readonly AttemptedFix[];
  readonly timestamps: ErrorTimestamps;
  readonly status: ReportStatus;
  readonly severity: ErrorSeverity;
  readonly creationOrder: number;
}

export interface ErrorDetails {
  readonly message: string;
  readonly code: string | null;
  readonly type: ErrorType;
  readonly stack: string | null;
  readonly source: string | null;
  readonly line: number | null;
  readonly column: number | null;
}

export type ErrorType = 'syntax' | 'runtime' | 'network' | 'validation' | 'timeout' | 'unknown';
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ReportStatus = 'open' | 'investigating' | 'fixing' | 'resolved' | 'wontfix';

export interface ErrorContext {
  readonly component: string | null;
  readonly action: string | null;
  readonly userInput: string | null;
  readonly sessionId: string | null;
  readonly environment: Record<string, string>;
  readonly additionalData: Record<string, unknown>;
}

export interface AttemptedFix {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  readonly success: boolean;
  readonly notes: string;
  readonly duration: number;
}

export interface ErrorTimestamps {
  readonly occurred: number;
  readonly reported: number;
  readonly lastUpdated: number;
  readonly resolved: number | null;
}

export interface ErrorReportState {
  readonly reports: Map<string, ErrorReport>;
  readonly activeReportId: string | null;
  readonly maxReports: number;
  readonly autoCleanup: boolean;
  readonly retentionMs: number;
}

export interface ReportSummary {
  readonly id: string;
  readonly errorMessage: string;
  readonly errorType: ErrorType;
  readonly severity: ErrorSeverity;
  readonly status: ReportStatus;
  readonly fixAttempts: number;
  readonly formattedTime: string;
  readonly age: string;
}

export type ReportHandler = (report: ErrorReport) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_REPORTS = 100;
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// State
// ============================================================================

let state: ErrorReportState = {
  reports: new Map(),
  activeReportId: null,
  maxReports: DEFAULT_MAX_REPORTS,
  autoCleanup: true,
  retentionMs: DEFAULT_RETENTION_MS,
};

let reportHandlers: ReportHandler[] = [];
let creationOrderCounter = 0;

// ============================================================================
// Report Creation
// ============================================================================

export function createReport(
  error: Partial<ErrorDetails>,
  context?: Partial<ErrorContext>
): ErrorReport {
  const id = generateId();
  const now = Date.now();

  const report: ErrorReport = {
    id,
    error: {
      message: error.message ?? 'Unknown error',
      code: error.code ?? null,
      type: error.type ?? 'unknown',
      stack: error.stack ?? null,
      source: error.source ?? null,
      line: error.line ?? null,
      column: error.column ?? null,
    },
    context: {
      component: context?.component ?? null,
      action: context?.action ?? null,
      userInput: context?.userInput ?? null,
      sessionId: context?.sessionId ?? null,
      environment: context?.environment ?? {},
      additionalData: context?.additionalData ?? {},
    },
    attemptedFixes: [],
    timestamps: {
      occurred: now,
      reported: now,
      lastUpdated: now,
      resolved: null,
    },
    status: 'open',
    severity: determineSeverity(error.type ?? 'unknown'),
    creationOrder: creationOrderCounter++,
  };

  const newReports = new Map(state.reports);
  newReports.set(id, report);

  state = {
    ...state,
    reports: newReports,
    activeReportId: id,
  };

  // Auto cleanup if needed
  if (state.autoCleanup) {
    cleanupOldReports();
  }

  // Notify handlers
  notifyReport(report);

  return report;
}

export function createReportFromError(err: Error, context?: Partial<ErrorContext>): ErrorReport {
  return createReport(
    {
      message: err.message,
      type: 'runtime',
      stack: err.stack ?? null,
    },
    context
  );
}

function determineSeverity(type: ErrorType): ErrorSeverity {
  switch (type) {
    case 'syntax':
      return 'high';
    case 'runtime':
      return 'high';
    case 'network':
      return 'medium';
    case 'validation':
      return 'low';
    case 'timeout':
      return 'medium';
    default:
      return 'medium';
  }
}

// ============================================================================
// Report Management
// ============================================================================

export function getReport(id: string): ErrorReport | null {
  return state.reports.get(id) ?? null;
}

export function getActiveReport(): ErrorReport | null {
  if (!state.activeReportId) {
    return null;
  }
  return state.reports.get(state.activeReportId) ?? null;
}

export function getAllReports(): readonly ErrorReport[] {
  return Array.from(state.reports.values()).sort((a, b) => {
    const timeDiff = b.timestamps.occurred - a.timestamps.occurred;
    return timeDiff !== 0 ? timeDiff : b.creationOrder - a.creationOrder;
  });
}

export function getReportsByStatus(status: ReportStatus): readonly ErrorReport[] {
  return getAllReports().filter(r => r.status === status);
}

export function getReportsBySeverity(severity: ErrorSeverity): readonly ErrorReport[] {
  return getAllReports().filter(r => r.severity === severity);
}

export function getOpenReports(): readonly ErrorReport[] {
  return getAllReports().filter(r => r.status !== 'resolved' && r.status !== 'wontfix');
}

export function setActiveReport(id: string): boolean {
  if (!state.reports.has(id)) {
    return false;
  }

  state = {
    ...state,
    activeReportId: id,
  };

  return true;
}

export function deleteReport(id: string): boolean {
  if (!state.reports.has(id)) {
    return false;
  }

  const newReports = new Map(state.reports);
  newReports.delete(id);

  state = {
    ...state,
    reports: newReports,
    activeReportId: state.activeReportId === id ? null : state.activeReportId,
  };

  return true;
}

// ============================================================================
// Status Updates
// ============================================================================

export function updateStatus(id: string, status: ReportStatus): ErrorReport | null {
  const report = state.reports.get(id);
  if (!report) {
    return null;
  }

  const now = Date.now();
  const updated: ErrorReport = {
    ...report,
    status,
    timestamps: {
      ...report.timestamps,
      lastUpdated: now,
      resolved: status === 'resolved' ? now : report.timestamps.resolved,
    },
  };

  const newReports = new Map(state.reports);
  newReports.set(id, updated);

  state = {
    ...state,
    reports: newReports,
  };

  return updated;
}

export function resolveReport(id: string): ErrorReport | null {
  return updateStatus(id, 'resolved');
}

export function setSeverity(id: string, severity: ErrorSeverity): ErrorReport | null {
  const report = state.reports.get(id);
  if (!report) {
    return null;
  }

  const updated: ErrorReport = {
    ...report,
    severity,
    timestamps: {
      ...report.timestamps,
      lastUpdated: Date.now(),
    },
  };

  const newReports = new Map(state.reports);
  newReports.set(id, updated);

  state = {
    ...state,
    reports: newReports,
  };

  return updated;
}

// ============================================================================
// Attempted Fixes
// ============================================================================

export function addAttemptedFix(
  reportId: string,
  description: string,
  success: boolean,
  notes: string = '',
  duration: number = 0
): AttemptedFix | null {
  const report = state.reports.get(reportId);
  if (!report) {
    return null;
  }

  const fix: AttemptedFix = {
    id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description,
    timestamp: Date.now(),
    success,
    notes,
    duration,
  };

  const updated: ErrorReport = {
    ...report,
    attemptedFixes: [...report.attemptedFixes, fix],
    status: success ? 'resolved' : 'fixing',
    timestamps: {
      ...report.timestamps,
      lastUpdated: Date.now(),
      resolved: success ? Date.now() : report.timestamps.resolved,
    },
  };

  const newReports = new Map(state.reports);
  newReports.set(reportId, updated);

  state = {
    ...state,
    reports: newReports,
  };

  return fix;
}

export function getAttemptedFixes(reportId: string): readonly AttemptedFix[] {
  const report = state.reports.get(reportId);
  return report?.attemptedFixes ?? [];
}

export function getFixCount(reportId: string): number {
  const report = state.reports.get(reportId);
  return report?.attemptedFixes.length ?? 0;
}

export function getSuccessfulFixes(reportId: string): readonly AttemptedFix[] {
  const report = state.reports.get(reportId);
  return report?.attemptedFixes.filter(f => f.success) ?? [];
}

// ============================================================================
// Context Updates
// ============================================================================

export function updateContext(
  reportId: string,
  context: Partial<ErrorContext>
): ErrorReport | null {
  const report = state.reports.get(reportId);
  if (!report) {
    return null;
  }

  const updated: ErrorReport = {
    ...report,
    context: {
      ...report.context,
      ...context,
      environment: { ...report.context.environment, ...context.environment },
      additionalData: { ...report.context.additionalData, ...context.additionalData },
    },
    timestamps: {
      ...report.timestamps,
      lastUpdated: Date.now(),
    },
  };

  const newReports = new Map(state.reports);
  newReports.set(reportId, updated);

  state = {
    ...state,
    reports: newReports,
  };

  return updated;
}

export function addContextData(
  reportId: string,
  key: string,
  value: unknown
): ErrorReport | null {
  const report = state.reports.get(reportId);
  if (!report) {
    return null;
  }

  return updateContext(reportId, {
    additionalData: { ...report.context.additionalData, [key]: value },
  });
}

// ============================================================================
// Report Summary
// ============================================================================

export function getReportSummary(id: string): ReportSummary | null {
  const report = state.reports.get(id);
  if (!report) {
    return null;
  }

  return {
    id: report.id,
    errorMessage: report.error.message,
    errorType: report.error.type,
    severity: report.severity,
    status: report.status,
    fixAttempts: report.attemptedFixes.length,
    formattedTime: formatTime(report.timestamps.occurred),
    age: formatAge(report.timestamps.occurred),
  };
}

export function getAllSummaries(): readonly ReportSummary[] {
  return getAllReports().map(r => ({
    id: r.id,
    errorMessage: r.error.message,
    errorType: r.error.type,
    severity: r.severity,
    status: r.status,
    fixAttempts: r.attemptedFixes.length,
    formattedTime: formatTime(r.timestamps.occurred),
    age: formatAge(r.timestamps.occurred),
  }));
}

// ============================================================================
// Report Export
// ============================================================================

export interface ExportedReport {
  readonly id: string;
  readonly error: ErrorDetails;
  readonly context: ErrorContext;
  readonly attemptedFixes: readonly AttemptedFix[];
  readonly timestamps: ErrorTimestamps;
  readonly status: ReportStatus;
  readonly severity: ErrorSeverity;
}

export function exportReport(id: string): ExportedReport | null {
  const report = state.reports.get(id);
  if (!report) {
    return null;
  }

  return {
    id: report.id,
    error: report.error,
    context: report.context,
    attemptedFixes: report.attemptedFixes,
    timestamps: report.timestamps,
    status: report.status,
    severity: report.severity,
  };
}

export function exportAllReports(): readonly ExportedReport[] {
  return getAllReports().map(r => ({
    id: r.id,
    error: r.error,
    context: r.context,
    attemptedFixes: r.attemptedFixes,
    timestamps: r.timestamps,
    status: r.status,
    severity: r.severity,
  }));
}

export function formatReportAsText(id: string): string | null {
  const report = state.reports.get(id);
  if (!report) {
    return null;
  }

  const lines: string[] = [
    '=== Error Report ===',
    `ID: ${report.id}`,
    `Status: ${report.status}`,
    `Severity: ${report.severity}`,
    '',
    '--- Error ---',
    `Message: ${report.error.message}`,
    `Type: ${report.error.type}`,
    report.error.code ? `Code: ${report.error.code}` : null,
    report.error.source ? `Source: ${report.error.source}` : null,
    report.error.line ? `Line: ${report.error.line}` : null,
    report.error.stack ? `Stack:\n${report.error.stack}` : null,
    '',
    '--- Context ---',
    report.context.component ? `Component: ${report.context.component}` : null,
    report.context.action ? `Action: ${report.context.action}` : null,
    report.context.userInput ? `User Input: ${report.context.userInput}` : null,
    '',
    '--- Attempted Fixes ---',
    ...report.attemptedFixes.map((f, i) =>
      `${i + 1}. [${f.success ? 'SUCCESS' : 'FAILED'}] ${f.description}` +
      (f.notes ? ` - ${f.notes}` : '') +
      ` (${formatTime(f.timestamp)})`
    ),
    '',
    '--- Timestamps ---',
    `Occurred: ${formatTime(report.timestamps.occurred)}`,
    `Reported: ${formatTime(report.timestamps.reported)}`,
    `Last Updated: ${formatTime(report.timestamps.lastUpdated)}`,
    report.timestamps.resolved ? `Resolved: ${formatTime(report.timestamps.resolved)}` : null,
  ];

  return lines.filter(l => l !== null).join('\n');
}

// ============================================================================
// Statistics
// ============================================================================

export function getReportCount(): number {
  return state.reports.size;
}

export function getOpenCount(): number {
  return getOpenReports().length;
}

export function getResolvedCount(): number {
  return getReportsByStatus('resolved').length;
}

export function getCountByType(): Record<ErrorType, number> {
  const counts: Record<ErrorType, number> = {
    syntax: 0,
    runtime: 0,
    network: 0,
    validation: 0,
    timeout: 0,
    unknown: 0,
  };

  for (const report of state.reports.values()) {
    counts[report.error.type]++;
  }

  return counts;
}

export function getCountBySeverity(): Record<ErrorSeverity, number> {
  const counts: Record<ErrorSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const report of state.reports.values()) {
    counts[report.severity]++;
  }

  return counts;
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupOldReports(): number {
  const now = Date.now();
  const cutoff = now - state.retentionMs;
  let cleaned = 0;

  const newReports = new Map<string, ErrorReport>();
  const sortedReports = getAllReports();

  for (const report of sortedReports) {
    // Keep if:
    // 1. Within retention period (skip check if retentionMs is 0 - means no retention)
    // 2. AND under max limit
    const withinRetention = state.retentionMs === 0 ? false : report.timestamps.occurred >= cutoff;
    if (withinRetention && newReports.size < state.maxReports) {
      newReports.set(report.id, report);
    } else if (state.retentionMs > 0 || newReports.size >= state.maxReports) {
      // Only count as cleaned if actually removing due to retention or max limit
      cleaned++;
    } else {
      // retentionMs is 0 and under max - still clean all
      cleaned++;
    }
  }

  state = {
    ...state,
    reports: newReports,
    activeReportId: newReports.has(state.activeReportId ?? '') ? state.activeReportId : null,
  };

  return cleaned;
}

export function setMaxReports(max: number): void {
  state = {
    ...state,
    maxReports: Math.max(1, max),
  };
}

export function setRetentionMs(ms: number): void {
  state = {
    ...state,
    retentionMs: Math.max(0, ms),
  };
}

export function setAutoCleanup(enabled: boolean): void {
  state = {
    ...state,
    autoCleanup: enabled,
  };
}

// ============================================================================
// Event Handlers
// ============================================================================

export function onReport(handler: ReportHandler): () => void {
  reportHandlers.push(handler);

  return () => {
    reportHandlers = reportHandlers.filter(h => h !== handler);
  };
}

function notifyReport(report: ErrorReport): void {
  for (const handler of reportHandlers) {
    handler(report);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function formatAge(timestamp: number): string {
  const ms = Date.now() - timestamp;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return `${seconds}s ago`;
}

// ============================================================================
// State Inspection
// ============================================================================

export function getState(): ErrorReportState {
  return {
    ...state,
    reports: new Map(state.reports),
  };
}

// ============================================================================
// Reset
// ============================================================================

export function resetErrorReport(): void {
  state = {
    reports: new Map(),
    activeReportId: null,
    maxReports: DEFAULT_MAX_REPORTS,
    autoCleanup: true,
    retentionMs: DEFAULT_RETENTION_MS,
  };
  reportHandlers = [];
  creationOrderCounter = 0;
}
