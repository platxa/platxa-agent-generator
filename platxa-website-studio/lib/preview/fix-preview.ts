/**
 * Fix Preview Before Applying
 *
 * Feature #159: Add fix preview before applying (diff view)
 * Verification: Shows unified diff of proposed fix; Apply/Cancel buttons
 *
 * Provides a preview interface for proposed fixes, showing unified diff
 * with Apply/Cancel actions before modifying code.
 */

import {
  createDiff,
  type FileDiff,
  type DiffHunk,
  type DiffLine,
  type DiffColors,
} from "./file-diff-display";

// ============================================================================
// Types
// ============================================================================

/** Preview action */
export type PreviewAction = "apply" | "cancel" | "edit" | "skip";

/** Preview status */
export type PreviewStatus = "pending" | "applied" | "cancelled" | "skipped" | "modified";

/** Button configuration */
export interface ButtonConfig {
  /** Button label */
  label: string;
  /** Button tooltip */
  tooltip?: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Button style variant */
  variant?: "primary" | "secondary" | "danger";
  /** Whether button is disabled */
  disabled?: boolean;
  /** Icon (optional) */
  icon?: string;
}

/** Fix change */
export interface FixChange {
  /** File path */
  filePath: string;
  /** Original content */
  originalContent: string;
  /** Fixed content */
  fixedContent: string;
  /** Change description */
  description?: string;
  /** Line range affected */
  lineRange?: {
    start: number;
    end: number;
  };
}

/** Fix metadata */
export interface FixMetadata {
  /** Fix ID */
  id: string;
  /** Fix title */
  title: string;
  /** Fix description */
  description: string;
  /** Error message being fixed */
  errorMessage?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Category of fix */
  category?: string;
  /** Whether fix is reversible */
  reversible?: boolean;
  /** Source of fix suggestion */
  source?: "auto" | "manual" | "ai";
}

/** Fix preview state */
export interface FixPreviewState {
  /** Current status */
  status: PreviewStatus;
  /** Fix metadata */
  fix: FixMetadata;
  /** Changes to apply */
  changes: FixChange[];
  /** Generated diffs */
  diffs: FileDiff[];
  /** Whether preview is expanded */
  expanded: boolean;
  /** Whether user has modified the fix */
  modified: boolean;
  /** User modifications (if any) */
  userModifications?: FixChange[];
  /** Timestamp when preview was created */
  createdAt: number;
  /** Timestamp when action was taken */
  actionAt?: number;
}

/** Preview options */
export interface FixPreviewOptions {
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Context lines around changes */
  contextLines?: number;
  /** Allow editing the fix */
  allowEdit?: boolean;
  /** Show confidence indicator */
  showConfidence?: boolean;
  /** Auto-collapse after threshold */
  autoCollapseLines?: number;
  /** Custom colors */
  colors?: Partial<DiffColors>;
  /** Custom button labels */
  buttons?: {
    apply?: Partial<ButtonConfig>;
    cancel?: Partial<ButtonConfig>;
    edit?: Partial<ButtonConfig>;
    skip?: Partial<ButtonConfig>;
  };
}

/** Apply callback */
export type ApplyCallback = (state: FixPreviewState) => void | Promise<void>;

/** Cancel callback */
export type CancelCallback = (state: FixPreviewState) => void;

/** Edit callback */
export type EditCallback = (state: FixPreviewState, modifiedChanges: FixChange[]) => void;

/** State change callback */
export type StateChangeCallback = (state: FixPreviewState) => void;

// ============================================================================
// Constants
// ============================================================================

/** Default button configurations */
export const DEFAULT_BUTTONS: Record<PreviewAction, ButtonConfig> = {
  apply: {
    label: "Apply Fix",
    tooltip: "Apply the proposed fix to your code",
    shortcut: "Ctrl+Enter",
    variant: "primary",
    icon: "check",
  },
  cancel: {
    label: "Cancel",
    tooltip: "Cancel and discard this fix",
    shortcut: "Escape",
    variant: "secondary",
    icon: "x",
  },
  edit: {
    label: "Edit",
    tooltip: "Modify the fix before applying",
    shortcut: "Ctrl+E",
    variant: "secondary",
    icon: "edit",
  },
  skip: {
    label: "Skip",
    tooltip: "Skip this fix for now",
    shortcut: "Ctrl+S",
    variant: "secondary",
    icon: "skip",
  },
};

/** Default options */
export const DEFAULT_OPTIONS: Required<FixPreviewOptions> = {
  showLineNumbers: true,
  contextLines: 3,
  allowEdit: false,
  showConfidence: true,
  autoCollapseLines: 50,
  colors: {},
  buttons: {},
};

/** Status labels */
export const STATUS_LABELS: Record<PreviewStatus, string> = {
  pending: "Pending Review",
  applied: "Applied",
  cancelled: "Cancelled",
  skipped: "Skipped",
  modified: "Modified & Applied",
};

/** Status colors */
export const STATUS_COLORS: Record<PreviewStatus, string> = {
  pending: "#f59e0b",  // amber
  applied: "#10b981",  // green
  cancelled: "#ef4444", // red
  skipped: "#6b7280",  // gray
  modified: "#8b5cf6", // purple
};

/** Confidence levels */
export const CONFIDENCE_LEVELS = {
  high: { min: 0.8, label: "High", color: "#10b981" },
  medium: { min: 0.5, label: "Medium", color: "#f59e0b" },
  low: { min: 0, label: "Low", color: "#ef4444" },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique preview ID
 */
export function generatePreviewId(): string {
  return `fxp-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get confidence level info
 */
export function getConfidenceLevel(confidence: number): {
  level: "high" | "medium" | "low";
  label: string;
  color: string;
} {
  if (confidence >= CONFIDENCE_LEVELS.high.min) {
    return { level: "high", ...CONFIDENCE_LEVELS.high };
  }
  if (confidence >= CONFIDENCE_LEVELS.medium.min) {
    return { level: "medium", ...CONFIDENCE_LEVELS.medium };
  }
  return { level: "low", ...CONFIDENCE_LEVELS.low };
}

/**
 * Create diff from fix change
 */
export function createFixDiff(change: FixChange): FileDiff {
  // createDiff signature: (filePath, oldContent, newContent)
  return createDiff(change.filePath, change.originalContent, change.fixedContent);
}

/**
 * Create all diffs from changes
 */
export function createAllDiffs(changes: FixChange[]): FileDiff[] {
  return changes.map(createFixDiff);
}

/**
 * Calculate total changes across diffs
 */
export function calculateTotalChanges(diffs: FileDiff[]): {
  additions: number;
  deletions: number;
  filesChanged: number;
} {
  return {
    additions: diffs.reduce((sum, d) => sum + d.additions, 0),
    deletions: diffs.reduce((sum, d) => sum + d.deletions, 0),
    filesChanged: diffs.length,
  };
}

/**
 * Format change summary
 */
export function formatChangeSummary(diffs: FileDiff[]): string {
  const { additions, deletions, filesChanged } = calculateTotalChanges(diffs);

  const parts: string[] = [];

  if (filesChanged === 1) {
    parts.push("1 file");
  } else {
    parts.push(`${filesChanged} files`);
  }

  if (additions > 0) {
    parts.push(`+${additions}`);
  }

  if (deletions > 0) {
    parts.push(`-${deletions}`);
  }

  return parts.join(", ");
}

/**
 * Check if fix is large (should auto-collapse)
 */
export function isLargeFix(diffs: FileDiff[], threshold: number): boolean {
  const totalLines = diffs.reduce((sum, d) => {
    return sum + d.hunks.reduce((hSum, h) => hSum + h.lines.length, 0);
  }, 0);
  return totalLines > threshold;
}

/**
 * Generate unified diff string
 */
export function generateUnifiedDiff(diff: FileDiff): string {
  const lines: string[] = [];

  // File header
  lines.push(`--- ${diff.oldFilePath || diff.filePath}`);
  lines.push(`+++ ${diff.filePath}`);

  // Hunks
  for (const hunk of diff.hunks) {
    lines.push(hunk.header);
    for (const line of hunk.lines) {
      const prefix = line.type === "added" ? "+" :
                     line.type === "removed" ? "-" : " ";
      lines.push(prefix + line.content);
    }
  }

  return lines.join("\n");
}

/**
 * Generate all unified diffs as string
 */
export function generateAllUnifiedDiffs(diffs: FileDiff[]): string {
  return diffs.map(generateUnifiedDiff).join("\n\n");
}

/**
 * Merge button config with defaults
 */
export function mergeButtonConfig(
  action: PreviewAction,
  custom?: Partial<ButtonConfig>
): ButtonConfig {
  return { ...DEFAULT_BUTTONS[action], ...custom };
}

/**
 * Get button config for all actions
 */
export function getButtonConfigs(
  options: FixPreviewOptions
): Record<PreviewAction, ButtonConfig> {
  return {
    apply: mergeButtonConfig("apply", options.buttons?.apply),
    cancel: mergeButtonConfig("cancel", options.buttons?.cancel),
    edit: mergeButtonConfig("edit", options.buttons?.edit),
    skip: mergeButtonConfig("skip", options.buttons?.skip),
  };
}

/**
 * Create initial preview state
 */
export function createPreviewState(
  fix: FixMetadata,
  changes: FixChange[]
): FixPreviewState {
  return {
    status: "pending",
    fix,
    changes,
    diffs: createAllDiffs(changes),
    expanded: true,
    modified: false,
    createdAt: Date.now(),
  };
}

// ============================================================================
// FixPreview Class
// ============================================================================

/**
 * Fix preview controller with Apply/Cancel actions
 */
export class FixPreview {
  private state: FixPreviewState;
  private options: Required<FixPreviewOptions>;
  private disposed = false;

  // Callbacks
  private onApply?: ApplyCallback;
  private onCancel?: CancelCallback;
  private onEdit?: EditCallback;
  private onStateChange?: StateChangeCallback;

  constructor(
    fix: FixMetadata,
    changes: FixChange[],
    options: FixPreviewOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = createPreviewState(fix, changes);
  }

  /**
   * Get current state
   */
  getState(): FixPreviewState {
    return { ...this.state };
  }

  /**
   * Get diffs
   */
  getDiffs(): FileDiff[] {
    return this.state.diffs;
  }

  /**
   * Get unified diff string
   */
  getUnifiedDiff(): string {
    return generateAllUnifiedDiffs(this.state.diffs);
  }

  /**
   * Get change summary
   */
  getSummary(): string {
    return formatChangeSummary(this.state.diffs);
  }

  /**
   * Get button configurations
   */
  getButtons(): Record<PreviewAction, ButtonConfig> {
    const buttons = getButtonConfigs(this.options);

    // Disable edit if not allowed
    if (!this.options.allowEdit) {
      buttons.edit.disabled = true;
    }

    // Disable all if not pending
    if (this.state.status !== "pending") {
      buttons.apply.disabled = true;
      buttons.cancel.disabled = true;
      buttons.edit.disabled = true;
      buttons.skip.disabled = true;
    }

    return buttons;
  }

  /**
   * Check if preview should be collapsed
   */
  shouldCollapse(): boolean {
    return isLargeFix(this.state.diffs, this.options.autoCollapseLines);
  }

  /**
   * Toggle expanded state
   */
  toggleExpanded(): void {
    this.checkDisposed();

    this.state = {
      ...this.state,
      expanded: !this.state.expanded,
    };

    this.notifyStateChange();
  }

  /**
   * Set expanded state
   */
  setExpanded(expanded: boolean): void {
    this.checkDisposed();

    if (this.state.expanded !== expanded) {
      this.state = {
        ...this.state,
        expanded,
      };
      this.notifyStateChange();
    }
  }

  /**
   * Apply the fix
   */
  async apply(): Promise<void> {
    this.checkDisposed();

    if (this.state.status !== "pending") {
      throw new Error(`Cannot apply fix with status: ${this.state.status}`);
    }

    this.state = {
      ...this.state,
      status: this.state.modified ? "modified" : "applied",
      actionAt: Date.now(),
    };

    this.notifyStateChange();

    if (this.onApply) {
      await this.onApply(this.state);
    }
  }

  /**
   * Cancel the fix
   */
  cancel(): void {
    this.checkDisposed();

    if (this.state.status !== "pending") {
      throw new Error(`Cannot cancel fix with status: ${this.state.status}`);
    }

    this.state = {
      ...this.state,
      status: "cancelled",
      actionAt: Date.now(),
    };

    this.notifyStateChange();
    this.onCancel?.(this.state);
  }

  /**
   * Skip the fix
   */
  skip(): void {
    this.checkDisposed();

    if (this.state.status !== "pending") {
      throw new Error(`Cannot skip fix with status: ${this.state.status}`);
    }

    this.state = {
      ...this.state,
      status: "skipped",
      actionAt: Date.now(),
    };

    this.notifyStateChange();
  }

  /**
   * Modify the fix (for edit mode)
   */
  modify(modifiedChanges: FixChange[]): void {
    this.checkDisposed();

    if (!this.options.allowEdit) {
      throw new Error("Editing is not allowed for this preview");
    }

    if (this.state.status !== "pending") {
      throw new Error(`Cannot modify fix with status: ${this.state.status}`);
    }

    this.state = {
      ...this.state,
      modified: true,
      userModifications: modifiedChanges,
      diffs: createAllDiffs(modifiedChanges),
    };

    this.notifyStateChange();
    this.onEdit?.(this.state, modifiedChanges);
  }

  /**
   * Reset modifications
   */
  resetModifications(): void {
    this.checkDisposed();

    if (!this.state.modified) return;

    this.state = {
      ...this.state,
      modified: false,
      userModifications: undefined,
      diffs: createAllDiffs(this.state.changes),
    };

    this.notifyStateChange();
  }

  /**
   * Get confidence info
   */
  getConfidenceInfo(): { level: string; label: string; color: string } | null {
    if (this.state.fix.confidence === undefined) return null;
    return getConfidenceLevel(this.state.fix.confidence);
  }

  /**
   * Check if action is allowed
   */
  canPerformAction(action: PreviewAction): boolean {
    if (this.state.status !== "pending") return false;
    if (action === "edit" && !this.options.allowEdit) return false;
    return true;
  }

  /**
   * Perform action by name
   */
  async performAction(action: PreviewAction): Promise<void> {
    switch (action) {
      case "apply":
        await this.apply();
        break;
      case "cancel":
        this.cancel();
        break;
      case "skip":
        this.skip();
        break;
      case "edit":
        // Edit mode just enables modification, doesn't apply
        break;
    }
  }

  /**
   * Set apply callback
   */
  setOnApply(callback: ApplyCallback): void {
    this.onApply = callback;
  }

  /**
   * Set cancel callback
   */
  setOnCancel(callback: CancelCallback): void {
    this.onCancel = callback;
  }

  /**
   * Set edit callback
   */
  setOnEdit(callback: EditCallback): void {
    this.onEdit = callback;
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback: StateChangeCallback): void {
    this.onStateChange = callback;
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    this.onStateChange?.(this.state);
  }

  /**
   * Check if disposed
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error("FixPreview is disposed");
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
    this.onApply = undefined;
    this.onCancel = undefined;
    this.onEdit = undefined;
    this.onStateChange = undefined;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new FixPreview instance
 */
export function createFixPreview(
  fix: FixMetadata,
  changes: FixChange[],
  options?: FixPreviewOptions
): FixPreview {
  return new FixPreview(fix, changes, options);
}

/**
 * Create fix preview from error and fix suggestion
 */
export function createFixPreviewFromSuggestion(
  errorMessage: string,
  fixTitle: string,
  fixDescription: string,
  changes: FixChange[],
  options?: FixPreviewOptions & { confidence?: number; category?: string }
): FixPreview {
  const fix: FixMetadata = {
    id: generatePreviewId(),
    title: fixTitle,
    description: fixDescription,
    errorMessage,
    confidence: options?.confidence,
    category: options?.category,
    reversible: true,
    source: "ai",
  };

  return createFixPreview(fix, changes, options);
}

/**
 * Quick preview for single file fix
 */
export function previewSingleFileFix(
  filePath: string,
  originalContent: string,
  fixedContent: string,
  title: string,
  description: string
): FixPreview {
  const fix: FixMetadata = {
    id: generatePreviewId(),
    title,
    description,
    reversible: true,
    source: "auto",
  };

  const changes: FixChange[] = [{
    filePath,
    originalContent,
    fixedContent,
    description,
  }];

  return createFixPreview(fix, changes);
}
