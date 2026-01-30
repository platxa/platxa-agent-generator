/**
 * ToolUsageIndicator — Tool usage indicators for chat messages.
 *
 * Feature #110: Implement tool usage indicators in chat messages
 * Verification: Chips show tools used: 'searched 3 files', 'edited 2 files'
 *
 * Tracks and displays tool usage as chips in chat messages,
 * aggregating counts for better readability.
 *
 * @module lib/preview/tool-usage-indicator
 */

// =============================================================================
// Types
// =============================================================================

/** Tool types that can be tracked */
export type ToolType =
  | "search"
  | "read"
  | "write"
  | "edit"
  | "delete"
  | "create"
  | "compile"
  | "validate"
  | "generate"
  | "analyze"
  | "deploy"
  | "test"
  | "fetch"
  | "execute";

/** Individual tool usage record */
export interface ToolUsage {
  /** Tool type */
  type: ToolType;
  /** Target (file path, URL, etc.) */
  target: string;
  /** Timestamp of usage */
  timestamp: number;
  /** Duration in ms (if completed) */
  duration?: number;
  /** Whether operation succeeded */
  success?: boolean;
  /** Additional details */
  details?: string;
}

/** Aggregated tool usage for display */
export interface AggregatedUsage {
  /** Tool type */
  type: ToolType;
  /** Number of usages */
  count: number;
  /** Formatted label (e.g., 'searched 3 files') */
  label: string;
  /** Short label for compact display */
  shortLabel: string;
  /** Icon name */
  icon: string;
  /** CSS classes for styling */
  className: string;
  /** List of targets */
  targets: string[];
  /** Total duration */
  totalDuration: number;
  /** Success rate (0-1) */
  successRate: number;
}

/** Chip configuration for rendering */
export interface UsageChip {
  /** Unique key for React */
  key: string;
  /** Display label */
  label: string;
  /** Icon name */
  icon: string;
  /** CSS classes */
  className: string;
  /** Tooltip text */
  tooltip: string;
  /** Tool type */
  type: ToolType;
  /** Count of operations */
  count: number;
  /** Whether chip is expandable */
  expandable: boolean;
  /** Expanded details */
  details?: string[];
}

/** Message tool usage summary */
export interface MessageUsageSummary {
  /** Message ID */
  messageId: string;
  /** All tool usages */
  usages: ToolUsage[];
  /** Aggregated by type */
  aggregated: AggregatedUsage[];
  /** Chips for rendering */
  chips: UsageChip[];
  /** Total operations count */
  totalOperations: number;
  /** Total duration */
  totalDuration: number;
  /** Overall success rate */
  overallSuccessRate: number;
}

/** Indicator options */
export interface ToolUsageIndicatorOptions {
  /** Minimum count to show chip (default: 1) */
  minCount?: number;
  /** Maximum chips to display (default: 5) */
  maxChips?: number;
  /** Show duration in chips (default: false) */
  showDuration?: boolean;
  /** Collapse similar tools (default: true) */
  collapseTools?: boolean;
  /** Custom tool labels */
  customLabels?: Partial<Record<ToolType, ToolLabelConfig>>;
}

/** Tool label configuration */
export interface ToolLabelConfig {
  /** Singular label (e.g., 'file') */
  singular: string;
  /** Plural label (e.g., 'files') */
  plural: string;
  /** Past tense verb (e.g., 'searched') */
  verb: string;
  /** Icon name */
  icon: string;
  /** CSS class */
  className: string;
}

/** State change callback */
export type StateChangeCallback = (summary: MessageUsageSummary) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default tool labels */
export const TOOL_LABELS: Record<ToolType, ToolLabelConfig> = {
  search: {
    singular: "file",
    plural: "files",
    verb: "searched",
    icon: "search",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  read: {
    singular: "file",
    plural: "files",
    verb: "read",
    icon: "file-text",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  write: {
    singular: "file",
    plural: "files",
    verb: "wrote",
    icon: "file-plus",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  edit: {
    singular: "file",
    plural: "files",
    verb: "edited",
    icon: "edit",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  delete: {
    singular: "file",
    plural: "files",
    verb: "deleted",
    icon: "trash",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  create: {
    singular: "file",
    plural: "files",
    verb: "created",
    icon: "plus",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  compile: {
    singular: "module",
    plural: "modules",
    verb: "compiled",
    icon: "package",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  validate: {
    singular: "check",
    plural: "checks",
    verb: "validated",
    icon: "check-circle",
    className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
  generate: {
    singular: "item",
    plural: "items",
    verb: "generated",
    icon: "sparkles",
    className: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  },
  analyze: {
    singular: "file",
    plural: "files",
    verb: "analyzed",
    icon: "bar-chart",
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  deploy: {
    singular: "deployment",
    plural: "deployments",
    verb: "deployed",
    icon: "upload-cloud",
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  },
  test: {
    singular: "test",
    plural: "tests",
    verb: "ran",
    icon: "play",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  fetch: {
    singular: "request",
    plural: "requests",
    verb: "fetched",
    icon: "globe",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  execute: {
    singular: "command",
    plural: "commands",
    verb: "executed",
    icon: "terminal",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

/** Default options */
const DEFAULT_OPTIONS: Required<ToolUsageIndicatorOptions> = {
  minCount: 1,
  maxChips: 5,
  showDuration: false,
  collapseTools: true,
  customLabels: {},
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets tool label configuration.
 */
export function getToolLabel(
  type: ToolType,
  customLabels?: Partial<Record<ToolType, ToolLabelConfig>>
): ToolLabelConfig {
  return customLabels?.[type] ?? TOOL_LABELS[type];
}

/**
 * Formats count with singular/plural.
 */
export function formatCount(
  count: number,
  singular: string,
  plural: string
): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

/**
 * Formats duration for display.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * Generates chip label.
 */
export function generateChipLabel(
  type: ToolType,
  count: number,
  customLabels?: Partial<Record<ToolType, ToolLabelConfig>>
): string {
  const config = getToolLabel(type, customLabels);
  const noun = formatCount(count, config.singular, config.plural);
  return `${config.verb} ${noun}`;
}

/**
 * Generates short chip label.
 */
export function generateShortLabel(
  type: ToolType,
  count: number,
  customLabels?: Partial<Record<ToolType, ToolLabelConfig>>
): string {
  const config = getToolLabel(type, customLabels);
  return `${count} ${count === 1 ? config.singular : config.plural}`;
}

/**
 * Truncates file path for display.
 */
export function truncatePath(path: string, maxLength: number = 30): string {
  if (path.length <= maxLength) return path;

  const filename = path.split("/").pop() ?? path;
  if (filename.length >= maxLength - 3) {
    return "..." + filename.slice(-(maxLength - 3));
  }

  return "..." + path.slice(-(maxLength - 3));
}

/**
 * Calculates success rate.
 */
export function calculateSuccessRate(usages: ToolUsage[]): number {
  const withStatus = usages.filter((u) => u.success !== undefined);
  if (withStatus.length === 0) return 1;

  const successful = withStatus.filter((u) => u.success === true).length;
  return successful / withStatus.length;
}

// =============================================================================
// ToolUsageIndicator Class
// =============================================================================

/**
 * ToolUsageIndicator — Tracks and displays tool usage in chat messages.
 *
 * @example
 * ```typescript
 * const indicator = new ToolUsageIndicator();
 *
 * // Track tool usages
 * indicator.track('msg-1', 'search', 'src/*.ts');
 * indicator.track('msg-1', 'edit', 'src/app.ts');
 * indicator.track('msg-1', 'edit', 'src/utils.ts');
 *
 * // Get summary for rendering
 * const summary = indicator.getSummary('msg-1');
 * // summary.chips = [
 * //   { label: 'searched 1 file', ... },
 * //   { label: 'edited 2 files', ... }
 * // ]
 * ```
 */
export class ToolUsageIndicator {
  private options: Required<ToolUsageIndicatorOptions>;
  private messageUsages = new Map<string, ToolUsage[]>();
  private callbacks = new Set<StateChangeCallback>();
  private disposed = false;

  constructor(options: ToolUsageIndicatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ---------------------------------------------------------------------------
  // Tracking
  // ---------------------------------------------------------------------------

  /**
   * Tracks a tool usage.
   */
  track(
    messageId: string,
    type: ToolType,
    target: string,
    details?: { duration?: number; success?: boolean; details?: string }
  ): void {
    if (this.disposed) return;

    const usage: ToolUsage = {
      type,
      target,
      timestamp: Date.now(),
      ...details,
    };

    const usages = this.messageUsages.get(messageId) ?? [];
    usages.push(usage);
    this.messageUsages.set(messageId, usages);

    this.notifyChange(messageId);
  }

  /**
   * Tracks multiple usages at once.
   */
  trackBatch(
    messageId: string,
    usages: Array<{ type: ToolType; target: string; duration?: number; success?: boolean }>
  ): void {
    if (this.disposed) return;

    const existing = this.messageUsages.get(messageId) ?? [];
    const newUsages: ToolUsage[] = usages.map((u) => ({
      type: u.type,
      target: u.target,
      timestamp: Date.now(),
      duration: u.duration,
      success: u.success,
    }));

    this.messageUsages.set(messageId, [...existing, ...newUsages]);
    this.notifyChange(messageId);
  }

  /**
   * Updates the last usage for a message.
   */
  complete(
    messageId: string,
    success: boolean,
    duration?: number
  ): void {
    if (this.disposed) return;

    const usages = this.messageUsages.get(messageId);
    if (!usages || usages.length === 0) return;

    const last = usages[usages.length - 1];
    last.success = success;
    if (duration !== undefined) last.duration = duration;

    this.notifyChange(messageId);
  }

  // ---------------------------------------------------------------------------
  // Aggregation
  // ---------------------------------------------------------------------------

  /**
   * Gets aggregated usage by type.
   */
  aggregate(messageId: string): AggregatedUsage[] {
    const usages = this.messageUsages.get(messageId) ?? [];
    const byType = new Map<ToolType, ToolUsage[]>();

    for (const usage of usages) {
      const existing = byType.get(usage.type) ?? [];
      existing.push(usage);
      byType.set(usage.type, existing);
    }

    const result: AggregatedUsage[] = [];

    for (const [type, typeUsages] of byType) {
      const config = getToolLabel(type, this.options.customLabels);
      const count = typeUsages.length;
      const targets = typeUsages.map((u) => u.target);
      const totalDuration = typeUsages.reduce((sum, u) => sum + (u.duration ?? 0), 0);
      const successRate = calculateSuccessRate(typeUsages);

      result.push({
        type,
        count,
        label: generateChipLabel(type, count, this.options.customLabels),
        shortLabel: generateShortLabel(type, count, this.options.customLabels),
        icon: config.icon,
        className: config.className,
        targets,
        totalDuration,
        successRate,
      });
    }

    // Sort by count descending
    result.sort((a, b) => b.count - a.count);

    return result;
  }

  /**
   * Gets chips for rendering.
   */
  getChips(messageId: string): UsageChip[] {
    const aggregated = this.aggregate(messageId);
    const chips: UsageChip[] = [];

    for (const agg of aggregated) {
      if (agg.count < this.options.minCount) continue;
      if (chips.length >= this.options.maxChips) break;

      const tooltip = this.buildTooltip(agg);
      const details = agg.targets.map((t) => truncatePath(t));

      chips.push({
        key: `${messageId}-${agg.type}`,
        label: agg.label,
        icon: agg.icon,
        className: agg.className,
        tooltip,
        type: agg.type,
        count: agg.count,
        expandable: agg.count > 1,
        details: agg.count > 1 ? details : undefined,
      });
    }

    return chips;
  }

  private buildTooltip(agg: AggregatedUsage): string {
    const parts: string[] = [agg.label];

    if (this.options.showDuration && agg.totalDuration > 0) {
      parts.push(`(${formatDuration(agg.totalDuration)})`);
    }

    if (agg.successRate < 1) {
      parts.push(`${Math.round(agg.successRate * 100)}% success`);
    }

    return parts.join(" ");
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  /**
   * Gets full summary for a message.
   */
  getSummary(messageId: string): MessageUsageSummary {
    const usages = this.messageUsages.get(messageId) ?? [];
    const aggregated = this.aggregate(messageId);
    const chips = this.getChips(messageId);

    const totalDuration = usages.reduce((sum, u) => sum + (u.duration ?? 0), 0);
    const overallSuccessRate = calculateSuccessRate(usages);

    return {
      messageId,
      usages: [...usages],
      aggregated,
      chips,
      totalOperations: usages.length,
      totalDuration,
      overallSuccessRate,
    };
  }

  /**
   * Gets usages for a message.
   */
  getUsages(messageId: string): ToolUsage[] {
    return [...(this.messageUsages.get(messageId) ?? [])];
  }

  /**
   * Checks if message has any usages.
   */
  hasUsages(messageId: string): boolean {
    const usages = this.messageUsages.get(messageId);
    return usages !== undefined && usages.length > 0;
  }

  /**
   * Gets count for a specific tool type.
   */
  getCountByType(messageId: string, type: ToolType): number {
    const usages = this.messageUsages.get(messageId) ?? [];
    return usages.filter((u) => u.type === type).length;
  }

  // ---------------------------------------------------------------------------
  // Management
  // ---------------------------------------------------------------------------

  /**
   * Clears usages for a message.
   */
  clear(messageId: string): void {
    if (this.disposed) return;

    this.messageUsages.delete(messageId);
    this.notifyChange(messageId);
  }

  /**
   * Clears all usages.
   */
  clearAll(): void {
    if (this.disposed) return;

    this.messageUsages.clear();
  }

  /**
   * Gets all tracked message IDs.
   */
  getMessageIds(): string[] {
    return Array.from(this.messageUsages.keys());
  }

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Registers a state change callback.
   */
  onChange(callback: StateChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyChange(messageId: string): void {
    if (this.disposed) return;

    const summary = this.getSummary(messageId);
    for (const callback of this.callbacks) {
      try {
        callback(summary);
      } catch (e) {
        console.error("ToolUsageIndicator callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the indicator.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.messageUsages.clear();
    this.callbacks.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a ToolUsageIndicator instance.
 */
export function createToolUsageIndicator(
  options?: ToolUsageIndicatorOptions
): ToolUsageIndicator {
  return new ToolUsageIndicator(options);
}

// =============================================================================
// Export
// =============================================================================

export default ToolUsageIndicator;
