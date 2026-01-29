/**
 * Inspect Logs Tool - Aggregate errors from SCSS, QWeb, Odoo, and preview
 *
 * Features:
 * - Unified log aggregation from multiple sources
 * - Severity classification (error, warning, info, debug)
 * - Query/filter capabilities
 * - Statistics about collected logs
 *
 * @module agentic-core/tools/inspect-logs
 */

import type { ToolParams, ToolResult } from '../tool-executor';
import {
  LogInspector,
  createLogInspector,
  type LogEntry,
  type LogFilter,
  type LogSeverity,
  type LogSource,
  type LogStats,
} from '../../preview/log-inspector';

// ============================================================================
// Types
// ============================================================================

/** Options for log inspection */
export interface InspectLogsOptions {
  /** Filter by severity levels */
  severity?: LogSeverity[];
  /** Filter by source systems */
  source?: LogSource[];
  /** Filter logs since this timestamp */
  since?: number;
  /** Filter logs until this timestamp */
  until?: number;
  /** Maximum number of entries to return (default: 100) */
  limit?: number;
  /** Include statistics in result */
  includeStats?: boolean;
  /** Export format for logs */
  exportFormat?: 'entries' | 'text' | 'json';
}

/** Result from log inspection */
export interface InspectLogsResult {
  /** Log entries matching the filter */
  entries: LogEntry[];
  /** Total count of matching entries */
  count: number;
  /** Whether there are errors in the result set */
  hasErrors: boolean;
  /** Count of errors */
  errorCount: number;
  /** Log statistics (if includeStats is true) */
  stats?: LogStats;
  /** Formatted export (if exportFormat is text/json) */
  exported?: string;
}

// ============================================================================
// Singleton LogInspector Instance
// ============================================================================

/** Global LogInspector instance for consistent log aggregation */
let globalInspector: LogInspector | null = null;

/**
 * Get or create the global LogInspector instance
 */
export function getLogInspector(): LogInspector {
  if (!globalInspector) {
    globalInspector = createLogInspector({
      maxEntries: 1000,
      includeDebug: false,
    });
  }
  return globalInspector;
}

/**
 * Reset the global LogInspector (for testing)
 */
export function resetLogInspector(): void {
  if (globalInspector) {
    globalInspector.clear();
  }
  globalInspector = null;
}

/**
 * Set a custom LogInspector instance (for testing or custom configuration)
 */
export function setLogInspector(inspector: LogInspector): void {
  globalInspector = inspector;
}

// ============================================================================
// Main Implementation
// ============================================================================

/**
 * Inspect and query aggregated logs from all sources
 *
 * @param options - Inspection options including filters
 * @returns Inspection result with matching entries and statistics
 */
export function inspectLogsImpl(options: InspectLogsOptions = {}): InspectLogsResult {
  const inspector = getLogInspector();
  const limit = options.limit ?? 100;
  const includeStats = options.includeStats ?? true;

  // Build filter from options
  const filter: LogFilter = {
    severity: options.severity,
    source: options.source,
    since: options.since,
    until: options.until,
    limit,
  };

  // Query logs with filter
  const entries = inspector.query(filter);
  const hasErrors = entries.some(e => e.severity === 'error');
  const errorCount = entries.filter(e => e.severity === 'error').length;

  // Build result
  const result: InspectLogsResult = {
    entries,
    count: entries.length,
    hasErrors,
    errorCount,
  };

  // Include statistics if requested
  if (includeStats) {
    result.stats = inspector.getStats();
  }

  // Export in requested format
  if (options.exportFormat === 'text') {
    result.exported = inspector.export('text');
  } else if (options.exportFormat === 'json') {
    result.exported = inspector.export('json');
  }

  return result;
}

/**
 * Get recent logs with optional severity filter
 */
export function getRecentLogs(
  count: number = 50,
  severity?: LogSeverity[]
): LogEntry[] {
  const inspector = getLogInspector();
  const filter: LogFilter = {
    severity,
    limit: count,
  };
  return inspector.query(filter);
}

/**
 * Get all errors from all sources
 */
export function getAllErrors(): LogEntry[] {
  return getLogInspector().getErrors();
}

/**
 * Get logs from a specific source
 */
export function getLogsBySource(source: LogSource): LogEntry[] {
  return getLogInspector().getBySource(source);
}

/**
 * Check if there are any errors in the log
 */
export function hasErrors(): boolean {
  return getLogInspector().hasErrors();
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  getLogInspector().clear();
}

// ============================================================================
// Tool Integration
// ============================================================================

/**
 * Inspect logs tool for AgentToolExecutor
 *
 * Aggregates and queries logs from SCSS, QWeb, Odoo, and preview sources.
 * Returns entries with severity classification and optional statistics.
 */
export async function inspectLogsTool(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    // Parse options from params
    const options: InspectLogsOptions = {
      severity: params.options?.severity as LogSeverity[] | undefined,
      source: params.options?.source as LogSource[] | undefined,
      since: params.options?.since as number | undefined,
      until: params.options?.until as number | undefined,
      limit: params.options?.limit as number | undefined,
      includeStats: params.options?.includeStats as boolean ?? true,
      exportFormat: params.options?.exportFormat as 'entries' | 'text' | 'json' | undefined,
    };

    // If target specifies a source, use it as filter
    if (params.target && params.target !== 'all') {
      const targetSource = params.target as LogSource;
      if (['scss', 'qweb', 'odoo', 'preview', 'bridge', 'hmr'].includes(targetSource)) {
        options.source = options.source ? [...options.source, targetSource] : [targetSource];
      }
    }

    const result = inspectLogsImpl(options);

    return {
      success: true,
      data: {
        entries: result.entries,
        count: result.count,
        hasErrors: result.hasErrors,
        errorCount: result.errorCount,
        stats: result.stats,
        exported: result.exported,
      },
      duration: Date.now() - startTime,
      toolName: 'inspect_logs',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'inspect_logs',
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default inspectLogsTool;
export type { LogEntry, LogFilter, LogSeverity, LogSource, LogStats };
