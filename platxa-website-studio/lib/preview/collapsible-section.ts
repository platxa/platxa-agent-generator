/**
 * Collapsible Plan/Execution Details for chat messages
 *
 * Feature #117: Create collapsible plan/execution details in messages
 * Verification: Expand/collapse toggle for detailed plan and execution logs
 */

// ============================================================================
// Types
// ============================================================================

/** Section type */
export type SectionType = "plan" | "execution" | "logs" | "details" | "error" | "debug";

/** Section status */
export type SectionStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/** Log entry severity */
export type LogSeverity = "info" | "warning" | "error" | "debug" | "success";

/** A single log entry */
export interface LogEntry {
  /** Entry ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Log message */
  message: string;
  /** Severity level */
  severity: LogSeverity;
  /** Optional details */
  details?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Plan step */
export interface PlanStep {
  /** Step ID */
  id: string;
  /** Step number (1-based) */
  number: number;
  /** Step description */
  description: string;
  /** Step status */
  status: SectionStatus;
  /** Duration in ms (if completed) */
  duration?: number;
  /** Sub-steps */
  subSteps?: PlanStep[];
  /** Output/result */
  output?: string;
}

/** Section content */
export interface SectionContent {
  /** Section ID */
  id: string;
  /** Section type */
  type: SectionType;
  /** Section title */
  title: string;
  /** Section summary (shown when collapsed) */
  summary?: string;
  /** Is section expanded */
  expanded: boolean;
  /** Section status */
  status: SectionStatus;
  /** Plan steps (for plan sections) */
  steps?: PlanStep[];
  /** Log entries (for execution/log sections) */
  logs?: LogEntry[];
  /** Raw content (for details sections) */
  content?: string;
  /** Timestamp */
  timestamp: number;
  /** Duration in ms */
  duration?: number;
  /** Child sections */
  children?: SectionContent[];
}

/** Toggle animation options */
export interface AnimationOptions {
  /** Enable animations */
  enabled: boolean;
  /** Duration in ms */
  duration: number;
  /** Easing function */
  easing: string;
}

/** Section display options */
export interface SectionDisplayOptions {
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Animation options */
  animation?: Partial<AnimationOptions>;
  /** Show timestamps */
  showTimestamps?: boolean;
  /** Show durations */
  showDurations?: boolean;
  /** Show status badges */
  showStatus?: boolean;
  /** Max collapsed preview length */
  maxPreviewLength?: number;
  /** Indent nested sections */
  indentNested?: boolean;
}

/** Rendered section */
export interface RenderedSection {
  /** Section ID */
  id: string;
  /** Header HTML */
  headerHtml: string;
  /** Content HTML */
  contentHtml: string;
  /** Full HTML */
  html: string;
  /** CSS classes */
  classes: string[];
  /** Is expanded */
  expanded: boolean;
  /** Toggle button config */
  toggle: {
    label: string;
    icon: string;
    ariaLabel: string;
  };
}

/** State change callback */
export type StateChangeCallback = (sections: SectionContent[]) => void;

/** Toggle callback */
export type ToggleCallback = (sectionId: string, expanded: boolean) => void;

/** Collapsible section manager options */
export interface CollapsibleSectionOptions extends SectionDisplayOptions {
  /** Auto-collapse siblings when expanding */
  autoCollapseSiblings?: boolean;
  /** Remember expansion state */
  rememberState?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default animation options */
export const DEFAULT_ANIMATION: AnimationOptions = {
  enabled: true,
  duration: 200,
  easing: "ease-out",
};

/** Section type labels */
export const SECTION_LABELS: Record<SectionType, string> = {
  plan: "Plan",
  execution: "Execution",
  logs: "Logs",
  details: "Details",
  error: "Error",
  debug: "Debug",
};

/** Section type icons (emoji) */
export const SECTION_ICONS: Record<SectionType, string> = {
  plan: "📋",
  execution: "⚡",
  logs: "📝",
  details: "ℹ️",
  error: "❌",
  debug: "🔧",
};

/** Status labels */
export const STATUS_LABELS: Record<SectionStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
};

/** Status colors */
export const STATUS_COLORS: Record<SectionStatus, string> = {
  pending: "#a1a1aa",
  running: "#3b82f6",
  completed: "#22c55e",
  failed: "#ef4444",
  skipped: "#71717a",
};

/** Log severity colors */
export const SEVERITY_COLORS: Record<LogSeverity, string> = {
  info: "#60a5fa",
  warning: "#fbbf24",
  error: "#ef4444",
  debug: "#a1a1aa",
  success: "#22c55e",
};

/** Toggle icons */
export const TOGGLE_ICONS = {
  expanded: "▼",
  collapsed: "▶",
};

/** Default options */
const DEFAULT_OPTIONS: Required<CollapsibleSectionOptions> = {
  defaultExpanded: false,
  animation: DEFAULT_ANIMATION,
  showTimestamps: false,
  showDurations: true,
  showStatus: true,
  maxPreviewLength: 100,
  indentNested: true,
  autoCollapseSiblings: false,
  rememberState: true,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique ID
 */
export function generateSectionId(): string {
  return `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format timestamp
 */
export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Get status badge HTML
 */
export function getStatusBadge(status: SectionStatus): string {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  return `<span class="status-badge status-${status}" style="color:${color}">${label}</span>`;
}

/**
 * Get severity badge HTML
 */
export function getSeverityBadge(severity: LogSeverity): string {
  const color = SEVERITY_COLORS[severity];
  return `<span class="severity-badge severity-${severity}" style="color:${color}">${severity.toUpperCase()}</span>`;
}

/**
 * Escape HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Create plan step summary
 */
export function createStepSummary(steps: PlanStep[]): string {
  const completed = steps.filter((s) => s.status === "completed").length;
  const total = steps.length;
  return `${completed}/${total} steps completed`;
}

/**
 * Create log summary
 */
export function createLogSummary(logs: LogEntry[]): string {
  const errors = logs.filter((l) => l.severity === "error").length;
  const warnings = logs.filter((l) => l.severity === "warning").length;

  const parts: string[] = [`${logs.length} entries`];
  if (errors > 0) parts.push(`${errors} errors`);
  if (warnings > 0) parts.push(`${warnings} warnings`);

  return parts.join(", ");
}

// ============================================================================
// CollapsibleSection Class
// ============================================================================

/**
 * Collapsible section manager for plan/execution details
 */
export class CollapsibleSection {
  private sections: Map<string, SectionContent> = new Map();
  private options: Required<CollapsibleSectionOptions>;
  private animation: AnimationOptions;
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private toggleCallbacks: Set<ToggleCallback> = new Set();
  private disposed = false;

  constructor(options: CollapsibleSectionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.animation = { ...DEFAULT_ANIMATION, ...options.animation };
  }

  /**
   * Add a section
   */
  addSection(section: Omit<SectionContent, "id" | "expanded" | "timestamp">): SectionContent {
    if (this.disposed) {
      throw new Error("CollapsibleSection is disposed");
    }

    const fullSection: SectionContent = {
      ...section,
      id: generateSectionId(),
      expanded: this.options.defaultExpanded,
      timestamp: Date.now(),
    };

    this.sections.set(fullSection.id, fullSection);
    this.notifyStateChange();

    return fullSection;
  }

  /**
   * Add a plan section
   */
  addPlanSection(title: string, steps: PlanStep[]): SectionContent {
    return this.addSection({
      type: "plan",
      title,
      summary: createStepSummary(steps),
      status: this.calculatePlanStatus(steps),
      steps,
    });
  }

  /**
   * Add an execution section
   */
  addExecutionSection(title: string, logs: LogEntry[]): SectionContent {
    return this.addSection({
      type: "execution",
      title,
      summary: createLogSummary(logs),
      status: this.calculateLogStatus(logs),
      logs,
    });
  }

  /**
   * Add a logs section
   */
  addLogsSection(title: string, logs: LogEntry[]): SectionContent {
    return this.addSection({
      type: "logs",
      title,
      summary: createLogSummary(logs),
      status: "completed",
      logs,
    });
  }

  /**
   * Add a details section
   */
  addDetailsSection(title: string, content: string): SectionContent {
    return this.addSection({
      type: "details",
      title,
      summary: truncateText(content, this.options.maxPreviewLength),
      status: "completed",
      content,
    });
  }

  /**
   * Calculate plan status from steps
   */
  private calculatePlanStatus(steps: PlanStep[]): SectionStatus {
    if (steps.length === 0) return "pending";
    if (steps.some((s) => s.status === "failed")) return "failed";
    if (steps.some((s) => s.status === "running")) return "running";
    if (steps.every((s) => s.status === "completed" || s.status === "skipped")) return "completed";
    return "pending";
  }

  /**
   * Calculate status from logs
   */
  private calculateLogStatus(logs: LogEntry[]): SectionStatus {
    if (logs.some((l) => l.severity === "error")) return "failed";
    return "completed";
  }

  /**
   * Update a section
   */
  updateSection(id: string, updates: Partial<SectionContent>): boolean {
    if (this.disposed) {
      throw new Error("CollapsibleSection is disposed");
    }

    const section = this.sections.get(id);
    if (!section) return false;

    const updated = { ...section, ...updates, id }; // Preserve ID
    this.sections.set(id, updated);
    this.notifyStateChange();

    return true;
  }

  /**
   * Remove a section
   */
  removeSection(id: string): boolean {
    const removed = this.sections.delete(id);
    if (removed) {
      this.notifyStateChange();
    }
    return removed;
  }

  /**
   * Clear all sections
   */
  clearSections(): void {
    this.sections.clear();
    this.notifyStateChange();
  }

  /**
   * Get a section
   */
  getSection(id: string): SectionContent | undefined {
    return this.sections.get(id);
  }

  /**
   * Get all sections
   */
  getAllSections(): SectionContent[] {
    return Array.from(this.sections.values());
  }

  /**
   * Toggle section expanded state
   */
  toggle(id: string): boolean {
    if (this.disposed) {
      throw new Error("CollapsibleSection is disposed");
    }

    const section = this.sections.get(id);
    if (!section) return false;

    const newExpanded = !section.expanded;
    section.expanded = newExpanded;

    // Auto-collapse siblings if enabled
    if (newExpanded && this.options.autoCollapseSiblings) {
      for (const [otherId, otherSection] of this.sections) {
        if (otherId !== id && otherSection.expanded) {
          otherSection.expanded = false;
        }
      }
    }

    this.notifyStateChange();
    this.notifyToggle(id, newExpanded);

    return newExpanded;
  }

  /**
   * Expand a section
   */
  expand(id: string): boolean {
    const section = this.sections.get(id);
    if (!section || section.expanded) return false;
    return this.toggle(id);
  }

  /**
   * Collapse a section
   */
  collapse(id: string): boolean {
    const section = this.sections.get(id);
    if (!section || !section.expanded) return false;
    return !this.toggle(id);
  }

  /**
   * Expand all sections
   */
  expandAll(): void {
    if (this.disposed) {
      throw new Error("CollapsibleSection is disposed");
    }

    for (const section of this.sections.values()) {
      section.expanded = true;
    }
    this.notifyStateChange();
  }

  /**
   * Collapse all sections
   */
  collapseAll(): void {
    if (this.disposed) {
      throw new Error("CollapsibleSection is disposed");
    }

    for (const section of this.sections.values()) {
      section.expanded = false;
    }
    this.notifyStateChange();
  }

  /**
   * Check if section is expanded
   */
  isExpanded(id: string): boolean {
    return this.sections.get(id)?.expanded ?? false;
  }

  /**
   * Render a section
   */
  renderSection(id: string): RenderedSection | null {
    const section = this.sections.get(id);
    if (!section) return null;

    const icon = SECTION_ICONS[section.type];
    const toggleIcon = section.expanded ? TOGGLE_ICONS.expanded : TOGGLE_ICONS.collapsed;
    const toggleLabel = section.expanded ? "Collapse" : "Expand";

    // Build header
    let headerHtml = `<div class="section-header ${section.expanded ? "expanded" : "collapsed"}">`;
    headerHtml += `<button class="toggle-btn" aria-expanded="${section.expanded}" aria-label="${toggleLabel} ${section.title}">`;
    headerHtml += `<span class="toggle-icon">${toggleIcon}</span>`;
    headerHtml += `</button>`;
    headerHtml += `<span class="section-icon">${icon}</span>`;
    headerHtml += `<span class="section-title">${escapeHtml(section.title)}</span>`;

    if (this.options.showStatus) {
      headerHtml += getStatusBadge(section.status);
    }

    if (section.summary && !section.expanded) {
      headerHtml += `<span class="section-summary">${escapeHtml(section.summary)}</span>`;
    }

    if (this.options.showDurations && section.duration) {
      headerHtml += `<span class="section-duration">${formatDuration(section.duration)}</span>`;
    }

    headerHtml += `</div>`;

    // Build content
    let contentHtml = `<div class="section-content" style="display:${section.expanded ? "block" : "none"}">`;

    if (section.steps) {
      contentHtml += this.renderSteps(section.steps);
    }

    if (section.logs) {
      contentHtml += this.renderLogs(section.logs);
    }

    if (section.content) {
      contentHtml += `<pre class="section-raw-content">${escapeHtml(section.content)}</pre>`;
    }

    contentHtml += `</div>`;

    const html = `<div class="collapsible-section section-${section.type}" data-section-id="${section.id}">${headerHtml}${contentHtml}</div>`;

    return {
      id: section.id,
      headerHtml,
      contentHtml,
      html,
      classes: [
        "collapsible-section",
        `section-${section.type}`,
        section.expanded ? "expanded" : "collapsed",
      ],
      expanded: section.expanded,
      toggle: {
        label: toggleLabel,
        icon: toggleIcon,
        ariaLabel: `${toggleLabel} ${section.title}`,
      },
    };
  }

  /**
   * Render plan steps
   */
  private renderSteps(steps: PlanStep[]): string {
    let html = '<ol class="plan-steps">';

    for (const step of steps) {
      const statusColor = STATUS_COLORS[step.status];
      html += `<li class="plan-step step-${step.status}" style="border-left-color:${statusColor}">`;
      html += `<span class="step-number">${step.number}.</span>`;
      html += `<span class="step-description">${escapeHtml(step.description)}</span>`;
      html += getStatusBadge(step.status);

      if (step.duration) {
        html += `<span class="step-duration">${formatDuration(step.duration)}</span>`;
      }

      if (step.output) {
        html += `<div class="step-output"><pre>${escapeHtml(step.output)}</pre></div>`;
      }

      if (step.subSteps && step.subSteps.length > 0) {
        html += this.renderSteps(step.subSteps);
      }

      html += `</li>`;
    }

    html += "</ol>";
    return html;
  }

  /**
   * Render log entries
   */
  private renderLogs(logs: LogEntry[]): string {
    let html = '<div class="log-entries">';

    for (const log of logs) {
      const color = SEVERITY_COLORS[log.severity];
      html += `<div class="log-entry log-${log.severity}" style="border-left-color:${color}">`;

      if (this.options.showTimestamps) {
        html += `<span class="log-timestamp">${formatTimestamp(log.timestamp)}</span>`;
      }

      html += getSeverityBadge(log.severity);
      html += `<span class="log-message">${escapeHtml(log.message)}</span>`;

      if (log.details) {
        html += `<pre class="log-details">${escapeHtml(log.details)}</pre>`;
      }

      html += `</div>`;
    }

    html += "</div>";
    return html;
  }

  /**
   * Render all sections
   */
  renderAllSections(): RenderedSection[] {
    const rendered: RenderedSection[] = [];
    for (const id of this.sections.keys()) {
      const section = this.renderSection(id);
      if (section) {
        rendered.push(section);
      }
    }
    return rendered;
  }

  /**
   * Get animation options
   */
  getAnimationOptions(): AnimationOptions {
    return { ...this.animation };
  }

  /**
   * Set animation options
   */
  setAnimationOptions(options: Partial<AnimationOptions>): void {
    if (this.disposed) {
      throw new Error("CollapsibleSection is disposed");
    }
    this.animation = { ...this.animation, ...options };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("CollapsibleSection is disposed");
    }

    this.stateCallbacks.add(callback);
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to toggle events
   */
  onToggle(callback: ToggleCallback): () => void {
    if (this.disposed) {
      throw new Error("CollapsibleSection is disposed");
    }

    this.toggleCallbacks.add(callback);
    return () => {
      this.toggleCallbacks.delete(callback);
    };
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    const sections = this.getAllSections();
    for (const callback of this.stateCallbacks) {
      try {
        callback(sections);
      } catch (err) {
        console.error("CollapsibleSection state callback error:", err);
      }
    }
  }

  /**
   * Notify toggle
   */
  private notifyToggle(id: string, expanded: boolean): void {
    for (const callback of this.toggleCallbacks) {
      try {
        callback(id, expanded);
      } catch (err) {
        console.error("CollapsibleSection toggle callback error:", err);
      }
    }
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.stateCallbacks.clear();
    this.toggleCallbacks.clear();
    this.sections.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new CollapsibleSection instance
 */
export function createCollapsibleSection(
  options?: CollapsibleSectionOptions
): CollapsibleSection {
  return new CollapsibleSection(options);
}

// ============================================================================
// Helper Builders
// ============================================================================

/**
 * Create a log entry
 */
export function createLogEntry(
  message: string,
  severity: LogSeverity = "info",
  details?: string
): LogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    message,
    severity,
    details,
  };
}

/**
 * Create a plan step
 */
export function createPlanStep(
  number: number,
  description: string,
  status: SectionStatus = "pending"
): PlanStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    number,
    description,
    status,
  };
}
