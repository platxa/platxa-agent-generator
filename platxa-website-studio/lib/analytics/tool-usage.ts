/**
 * Tool Usage Tracking and Analytics
 *
 * Track and analyze agent tool usage for understanding behavior patterns,
 * optimizing workflows, and improving agent effectiveness.
 */

// ============================================================================
// Types
// ============================================================================

export type ToolCategory =
  | 'code_generation'
  | 'code_editing'
  | 'file_operations'
  | 'search'
  | 'analysis'
  | 'deployment'
  | 'collaboration'
  | 'external_api'
  | 'ui_interaction'
  | 'other';

export interface ToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  parameters?: ToolParameter[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
}

export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface ToolInvocation {
  id: string;
  toolId: string;
  sessionId: string;
  agentId?: string;
  userId?: string;
  projectId?: string;
  timestamp: Date;
  parameters: Record<string, unknown>;
  result: ToolResult;
  duration: number; // ms
  context?: ToolContext;
}

export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
  errorCode?: string;
  affectedFiles?: string[];
  linesChanged?: number;
  tokensGenerated?: number;
}

export interface ToolContext {
  conversationTurn: number;
  previousTools: string[];
  userIntent?: string;
  taskType?: string;
  fileContext?: string[];
}

export interface ToolUsageSummary {
  period: 'hour' | 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  uniqueTools: number;
  averageDuration: number;
  byTool: ToolBreakdown[];
  byCategory: CategoryBreakdown[];
  byHour?: HourlyToolUsage[];
  topSequences: ToolSequence[];
  errorPatterns: ErrorPattern[];
}

export interface ToolBreakdown {
  toolId: string;
  toolName: string;
  category: ToolCategory;
  invocations: number;
  successRate: number;
  averageDuration: number;
  percentage: number;
}

export interface CategoryBreakdown {
  category: ToolCategory;
  invocations: number;
  successRate: number;
  tools: string[];
  percentage: number;
}

export interface HourlyToolUsage {
  hour: number;
  invocations: number;
  uniqueTools: number;
  successRate: number;
}

export interface ToolSequence {
  sequence: string[];
  count: number;
  averageSuccess: number;
  commonContext?: string;
}

export interface ErrorPattern {
  errorCode: string;
  toolId: string;
  count: number;
  lastOccurrence: Date;
  commonCause?: string;
}

export interface AgentBehaviorInsight {
  type: 'efficiency' | 'pattern' | 'anomaly' | 'recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedTools: string[];
  suggestion?: string;
  metrics?: Record<string, number>;
}

// ============================================================================
// Tool Registry
// ============================================================================

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // Code Generation Tools
  'generate_code': {
    id: 'generate_code',
    name: 'Generate Code',
    category: 'code_generation',
    description: 'Generate new code based on requirements',
    riskLevel: 'medium',
    requiresConfirmation: false,
  },
  'generate_component': {
    id: 'generate_component',
    name: 'Generate Component',
    category: 'code_generation',
    description: 'Generate a UI component',
    riskLevel: 'medium',
    requiresConfirmation: false,
  },
  'generate_test': {
    id: 'generate_test',
    name: 'Generate Test',
    category: 'code_generation',
    description: 'Generate unit or integration tests',
    riskLevel: 'low',
    requiresConfirmation: false,
  },

  // Code Editing Tools
  'edit_file': {
    id: 'edit_file',
    name: 'Edit File',
    category: 'code_editing',
    description: 'Edit an existing file',
    riskLevel: 'medium',
    requiresConfirmation: true,
  },
  'refactor_code': {
    id: 'refactor_code',
    name: 'Refactor Code',
    category: 'code_editing',
    description: 'Refactor existing code',
    riskLevel: 'medium',
    requiresConfirmation: true,
  },
  'fix_error': {
    id: 'fix_error',
    name: 'Fix Error',
    category: 'code_editing',
    description: 'Fix a code error or bug',
    riskLevel: 'medium',
    requiresConfirmation: false,
  },

  // File Operations
  'create_file': {
    id: 'create_file',
    name: 'Create File',
    category: 'file_operations',
    description: 'Create a new file',
    riskLevel: 'low',
    requiresConfirmation: false,
  },
  'delete_file': {
    id: 'delete_file',
    name: 'Delete File',
    category: 'file_operations',
    description: 'Delete a file',
    riskLevel: 'high',
    requiresConfirmation: true,
  },
  'move_file': {
    id: 'move_file',
    name: 'Move File',
    category: 'file_operations',
    description: 'Move or rename a file',
    riskLevel: 'medium',
    requiresConfirmation: true,
  },
  'read_file': {
    id: 'read_file',
    name: 'Read File',
    category: 'file_operations',
    description: 'Read file contents',
    riskLevel: 'low',
    requiresConfirmation: false,
  },

  // Search Tools
  'search_codebase': {
    id: 'search_codebase',
    name: 'Search Codebase',
    category: 'search',
    description: 'Search across the codebase',
    riskLevel: 'low',
    requiresConfirmation: false,
  },
  'find_references': {
    id: 'find_references',
    name: 'Find References',
    category: 'search',
    description: 'Find all references to a symbol',
    riskLevel: 'low',
    requiresConfirmation: false,
  },
  'search_web': {
    id: 'search_web',
    name: 'Search Web',
    category: 'search',
    description: 'Search the web for information',
    riskLevel: 'low',
    requiresConfirmation: false,
  },

  // Analysis Tools
  'analyze_code': {
    id: 'analyze_code',
    name: 'Analyze Code',
    category: 'analysis',
    description: 'Analyze code for issues or patterns',
    riskLevel: 'low',
    requiresConfirmation: false,
  },
  'review_changes': {
    id: 'review_changes',
    name: 'Review Changes',
    category: 'analysis',
    description: 'Review code changes',
    riskLevel: 'low',
    requiresConfirmation: false,
  },
  'check_types': {
    id: 'check_types',
    name: 'Check Types',
    category: 'analysis',
    description: 'Run type checking',
    riskLevel: 'low',
    requiresConfirmation: false,
  },

  // Deployment Tools
  'deploy_preview': {
    id: 'deploy_preview',
    name: 'Deploy Preview',
    category: 'deployment',
    description: 'Deploy a preview environment',
    riskLevel: 'medium',
    requiresConfirmation: true,
  },
  'deploy_production': {
    id: 'deploy_production',
    name: 'Deploy Production',
    category: 'deployment',
    description: 'Deploy to production',
    riskLevel: 'high',
    requiresConfirmation: true,
  },
  'run_build': {
    id: 'run_build',
    name: 'Run Build',
    category: 'deployment',
    description: 'Run the build process',
    riskLevel: 'low',
    requiresConfirmation: false,
  },

  // Collaboration Tools
  'create_pr': {
    id: 'create_pr',
    name: 'Create Pull Request',
    category: 'collaboration',
    description: 'Create a pull request',
    riskLevel: 'medium',
    requiresConfirmation: true,
  },
  'commit_changes': {
    id: 'commit_changes',
    name: 'Commit Changes',
    category: 'collaboration',
    description: 'Commit changes to git',
    riskLevel: 'medium',
    requiresConfirmation: true,
  },
  'add_comment': {
    id: 'add_comment',
    name: 'Add Comment',
    category: 'collaboration',
    description: 'Add a code comment or review comment',
    riskLevel: 'low',
    requiresConfirmation: false,
  },

  // External API Tools
  'call_api': {
    id: 'call_api',
    name: 'Call API',
    category: 'external_api',
    description: 'Make an external API call',
    riskLevel: 'medium',
    requiresConfirmation: false,
  },
  'fetch_data': {
    id: 'fetch_data',
    name: 'Fetch Data',
    category: 'external_api',
    description: 'Fetch data from external source',
    riskLevel: 'low',
    requiresConfirmation: false,
  },

  // UI Interaction Tools
  'update_preview': {
    id: 'update_preview',
    name: 'Update Preview',
    category: 'ui_interaction',
    description: 'Update the preview panel',
    riskLevel: 'low',
    requiresConfirmation: false,
  },
  'select_element': {
    id: 'select_element',
    name: 'Select Element',
    category: 'ui_interaction',
    description: 'Select an element in the preview',
    riskLevel: 'low',
    requiresConfirmation: false,
  },
};

// ============================================================================
// Tool Usage Tracker
// ============================================================================

export class ToolUsageTracker {
  private invocations: ToolInvocation[] = [];
  private listeners: Set<(invocation: ToolInvocation) => void> = new Set();
  private sequenceWindow = 5; // Number of tools to track in sequences

  /**
   * Record a tool invocation
   */
  recordInvocation(
    params: Omit<ToolInvocation, 'id' | 'timestamp'>
  ): ToolInvocation {
    const invocation: ToolInvocation = {
      ...params,
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.invocations.push(invocation);
    this.notifyListeners(invocation);

    return invocation;
  }

  /**
   * Start timing a tool invocation
   */
  startInvocation(
    toolId: string,
    sessionId: string,
    parameters: Record<string, unknown>,
    context?: ToolContext
  ): { complete: (result: ToolResult) => ToolInvocation } {
    const startTime = Date.now();

    return {
      complete: (result: ToolResult) => {
        return this.recordInvocation({
          toolId,
          sessionId,
          parameters,
          result,
          duration: Date.now() - startTime,
          context,
        });
      },
    };
  }

  /**
   * Get usage summary for a period
   */
  getSummary(period: ToolUsageSummary['period'], startDate?: Date): ToolUsageSummary {
    const now = new Date();
    const start = startDate || this.getPeriodStart(period, now);
    const end = now;

    const filtered = this.invocations.filter(
      (i) => i.timestamp >= start && i.timestamp <= end
    );

    const successful = filtered.filter((i) => i.result.success);
    const failed = filtered.filter((i) => !i.result.success);

    // Group by tool
    const toolGroups = this.groupBy(filtered, 'toolId');
    const totalInvocations = filtered.length;

    const byTool: ToolBreakdown[] = Object.entries(toolGroups)
      .map(([toolId, invocations]) => {
        const tool = TOOL_REGISTRY[toolId];
        const successCount = invocations.filter((i) => i.result.success).length;
        const durations = invocations.map((i) => i.duration);

        return {
          toolId,
          toolName: tool?.name || toolId,
          category: tool?.category || 'other',
          invocations: invocations.length,
          successRate: invocations.length > 0 ? (successCount / invocations.length) * 100 : 0,
          averageDuration: durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0,
          percentage: totalInvocations > 0
            ? (invocations.length / totalInvocations) * 100
            : 0,
        };
      })
      .sort((a, b) => b.invocations - a.invocations);

    // Group by category
    const categoryGroups = this.groupBy(filtered, (i) => {
      const tool = TOOL_REGISTRY[i.toolId];
      return tool?.category || 'other';
    });

    const byCategory: CategoryBreakdown[] = Object.entries(categoryGroups)
      .map(([category, invocations]) => {
        const successCount = invocations.filter((i) => i.result.success).length;
        const toolIds = [...new Set(invocations.map((i) => i.toolId))];

        return {
          category: category as ToolCategory,
          invocations: invocations.length,
          successRate: invocations.length > 0 ? (successCount / invocations.length) * 100 : 0,
          tools: toolIds,
          percentage: totalInvocations > 0
            ? (invocations.length / totalInvocations) * 100
            : 0,
        };
      })
      .sort((a, b) => b.invocations - a.invocations);

    // Hourly breakdown (for day view)
    let byHour: HourlyToolUsage[] | undefined;
    if (period === 'day') {
      byHour = Array.from({ length: 24 }, (_, hour) => {
        const hourInvocations = filtered.filter((i) => i.timestamp.getHours() === hour);
        const hourSuccess = hourInvocations.filter((i) => i.result.success).length;

        return {
          hour,
          invocations: hourInvocations.length,
          uniqueTools: new Set(hourInvocations.map((i) => i.toolId)).size,
          successRate: hourInvocations.length > 0
            ? (hourSuccess / hourInvocations.length) * 100
            : 0,
        };
      });
    }

    // Find common tool sequences
    const topSequences = this.findTopSequences(filtered);

    // Find error patterns
    const errorPatterns = this.findErrorPatterns(failed);

    // Calculate average duration
    const durations = filtered.map((i) => i.duration);
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      period,
      startDate: start,
      endDate: end,
      totalInvocations,
      successfulInvocations: successful.length,
      failedInvocations: failed.length,
      uniqueTools: new Set(filtered.map((i) => i.toolId)).size,
      averageDuration,
      byTool,
      byCategory,
      byHour,
      topSequences,
      errorPatterns,
    };
  }

  /**
   * Get behavior insights
   */
  getInsights(): AgentBehaviorInsight[] {
    const insights: AgentBehaviorInsight[] = [];
    const summary = this.getSummary('week');

    // Check for inefficient tool usage patterns
    const searchTools = summary.byTool.filter((t) => t.category === 'search');
    const totalSearches = searchTools.reduce((sum, t) => sum + t.invocations, 0);
    const editTools = summary.byTool.filter((t) => t.category === 'code_editing');
    const totalEdits = editTools.reduce((sum, t) => sum + t.invocations, 0);

    if (totalSearches > totalEdits * 3 && totalSearches > 20) {
      insights.push({
        type: 'efficiency',
        severity: 'warning',
        title: 'High search-to-edit ratio',
        description: `Agent performed ${totalSearches} searches for only ${totalEdits} edits. This may indicate inefficient context gathering.`,
        affectedTools: searchTools.map((t) => t.toolId),
        suggestion: 'Consider caching search results or improving initial context provided to the agent.',
        metrics: { searches: totalSearches, edits: totalEdits, ratio: totalSearches / Math.max(totalEdits, 1) },
      });
    }

    // Check for high failure rates
    for (const tool of summary.byTool) {
      if (tool.invocations >= 10 && tool.successRate < 70) {
        insights.push({
          type: 'anomaly',
          severity: tool.successRate < 50 ? 'critical' : 'warning',
          title: `High failure rate for ${tool.toolName}`,
          description: `${tool.toolName} has a ${tool.successRate.toFixed(1)}% success rate over ${tool.invocations} invocations.`,
          affectedTools: [tool.toolId],
          suggestion: 'Review error patterns and consider adding validation or error handling.',
          metrics: { successRate: tool.successRate, invocations: tool.invocations },
        });
      }
    }

    // Check for common error patterns
    for (const error of summary.errorPatterns) {
      if (error.count >= 5) {
        const tool = TOOL_REGISTRY[error.toolId];
        insights.push({
          type: 'pattern',
          severity: error.count >= 10 ? 'critical' : 'warning',
          title: `Recurring error: ${error.errorCode}`,
          description: `Error "${error.errorCode}" occurred ${error.count} times with ${tool?.name || error.toolId}.`,
          affectedTools: [error.toolId],
          suggestion: error.commonCause || 'Investigate the root cause of this recurring error.',
          metrics: { occurrences: error.count },
        });
      }
    }

    // Check for repetitive sequences (potential automation opportunity)
    for (const seq of summary.topSequences) {
      if (seq.count >= 5 && seq.sequence.length >= 3) {
        insights.push({
          type: 'recommendation',
          severity: 'info',
          title: 'Repetitive tool sequence detected',
          description: `The sequence [${seq.sequence.join(' → ')}] was used ${seq.count} times.`,
          affectedTools: seq.sequence,
          suggestion: 'Consider creating a composite tool or workflow for this common pattern.',
          metrics: { occurrences: seq.count, avgSuccess: seq.averageSuccess },
        });
      }
    }

    // Check for slow tools
    for (const tool of summary.byTool) {
      if (tool.averageDuration > 5000 && tool.invocations >= 5) { // > 5 seconds
        insights.push({
          type: 'efficiency',
          severity: 'info',
          title: `Slow tool: ${tool.toolName}`,
          description: `${tool.toolName} averages ${(tool.averageDuration / 1000).toFixed(1)}s per invocation.`,
          affectedTools: [tool.toolId],
          suggestion: 'Consider optimizing this tool or providing progress feedback to users.',
          metrics: { averageDuration: tool.averageDuration },
        });
      }
    }

    return insights.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get tool invocations for a session
   */
  getSessionInvocations(sessionId: string): ToolInvocation[] {
    return this.invocations.filter((i) => i.sessionId === sessionId);
  }

  /**
   * Subscribe to invocation events
   */
  onInvocation(listener: (invocation: ToolInvocation) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Export data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'id', 'timestamp', 'toolId', 'sessionId', 'duration',
        'success', 'errorCode', 'affectedFiles', 'linesChanged'
      ];
      const rows = this.invocations.map((i) => [
        i.id,
        i.timestamp.toISOString(),
        i.toolId,
        i.sessionId,
        i.duration,
        i.result.success,
        i.result.errorCode || '',
        (i.result.affectedFiles || []).join(';'),
        i.result.linesChanged || 0,
      ]);
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    return JSON.stringify(this.invocations, null, 2);
  }

  /**
   * Clear old records
   */
  pruneRecords(olderThan: Date): number {
    const initialCount = this.invocations.length;
    this.invocations = this.invocations.filter((i) => i.timestamp >= olderThan);
    return initialCount - this.invocations.length;
  }

  // Private helpers

  private getPeriodStart(period: ToolUsageSummary['period'], from: Date): Date {
    const start = new Date(from);
    switch (period) {
      case 'hour':
        start.setMinutes(0, 0, 0);
        break;
      case 'day':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - start.getDay());
        break;
      case 'month':
        start.setHours(0, 0, 0, 0);
        start.setDate(1);
        break;
    }
    return start;
  }

  private groupBy<T>(
    items: T[],
    keyOrFn: keyof T | ((item: T) => string)
  ): Record<string, T[]> {
    return items.reduce((groups, item) => {
      const key = typeof keyOrFn === 'function'
        ? keyOrFn(item)
        : String(item[keyOrFn]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private findTopSequences(invocations: ToolInvocation[]): ToolSequence[] {
    const sequences = new Map<string, { count: number; successes: number }>();

    // Group by session and sort by timestamp
    const sessions = this.groupBy(invocations, 'sessionId');

    for (const sessionInvocations of Object.values(sessions)) {
      const sorted = sessionInvocations.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      // Extract sequences of length 2-5
      for (let len = 2; len <= this.sequenceWindow; len++) {
        for (let i = 0; i <= sorted.length - len; i++) {
          const seq = sorted.slice(i, i + len).map((inv) => inv.toolId);
          const key = seq.join('→');
          const success = sorted.slice(i, i + len).every((inv) => inv.result.success);

          const existing = sequences.get(key) || { count: 0, successes: 0 };
          existing.count++;
          if (success) existing.successes++;
          sequences.set(key, existing);
        }
      }
    }

    return Array.from(sequences.entries())
      .map(([key, data]) => ({
        sequence: key.split('→'),
        count: data.count,
        averageSuccess: data.count > 0 ? (data.successes / data.count) * 100 : 0,
      }))
      .filter((s) => s.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private findErrorPatterns(failed: ToolInvocation[]): ErrorPattern[] {
    const patterns = new Map<string, ErrorPattern>();

    for (const inv of failed) {
      const errorCode = inv.result.errorCode || 'UNKNOWN';
      const key = `${inv.toolId}:${errorCode}`;

      if (!patterns.has(key)) {
        patterns.set(key, {
          errorCode,
          toolId: inv.toolId,
          count: 0,
          lastOccurrence: inv.timestamp,
        });
      }

      const pattern = patterns.get(key)!;
      pattern.count++;
      if (inv.timestamp > pattern.lastOccurrence) {
        pattern.lastOccurrence = inv.timestamp;
      }
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private notifyListeners(invocation: ToolInvocation): void {
    this.listeners.forEach((listener) => {
      try {
        listener(invocation);
      } catch (e) {
        console.error('Tool usage listener error:', e);
      }
    });
  }
}

// ============================================================================
// Dashboard Data Helpers
// ============================================================================

export interface ToolDashboardData {
  topTools: Array<{ name: string; count: number; successRate: number }>;
  categoryDistribution: Array<{ category: string; percentage: number }>;
  usageTrend: Array<{ date: string; invocations: number }>;
  recentErrors: Array<{ tool: string; error: string; time: string }>;
  activeInsights: number;
}

export function generateToolDashboardData(tracker: ToolUsageTracker): ToolDashboardData {
  const summary = tracker.getSummary('week');
  const insights = tracker.getInsights();

  // Usage trend for last 7 days
  const usageTrend: Array<{ date: string; invocations: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const daySummary = tracker.getSummary('day', date);
    usageTrend.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      invocations: daySummary.totalInvocations,
    });
  }

  // Recent errors
  const recentErrors = summary.errorPatterns.slice(0, 5).map((e) => ({
    tool: TOOL_REGISTRY[e.toolId]?.name || e.toolId,
    error: e.errorCode,
    time: e.lastOccurrence.toLocaleTimeString(),
  }));

  return {
    topTools: summary.byTool.slice(0, 5).map((t) => ({
      name: t.toolName,
      count: t.invocations,
      successRate: t.successRate,
    })),
    categoryDistribution: summary.byCategory.map((c) => ({
      category: c.category,
      percentage: c.percentage,
    })),
    usageTrend,
    recentErrors,
    activeInsights: insights.filter((i) => i.severity !== 'info').length,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let trackerInstance: ToolUsageTracker | null = null;

export function getToolTracker(): ToolUsageTracker {
  if (!trackerInstance) {
    trackerInstance = new ToolUsageTracker();
  }
  return trackerInstance;
}

export default ToolUsageTracker;
