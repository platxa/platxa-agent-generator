/**
 * CommitManager - Auto-commit changes with meaningful commit messages
 *
 * Provides intelligent auto-commit functionality that:
 * - Tracks file changes and generates meaningful commit messages
 * - Batches changes for efficient commits
 * - Supports different commit strategies (immediate, batched, manual)
 * - Generates conventional commit messages based on change analysis
 *
 * Feature #44: GitHub Integration - Auto-commit
 */

import {
  GitService,
  generateCommitMessage,
  type GitCommit,
  type GitOperationResult,
} from "./index";

// =============================================================================
// Types
// =============================================================================

/** File change tracking */
export interface FileChange {
  /** File path */
  path: string;
  /** Type of change */
  type: "created" | "modified" | "deleted" | "renamed";
  /** Previous path (for renames) */
  oldPath?: string;
  /** File content (for created/modified) */
  content?: string;
  /** Timestamp of change */
  timestamp: number;
  /** Category of file */
  category: FileCategory;
}

/** File categories for commit message generation */
export type FileCategory =
  | "component"
  | "style"
  | "template"
  | "config"
  | "asset"
  | "documentation"
  | "test"
  | "other";

/** Commit strategy */
export type CommitStrategy = "immediate" | "batched" | "manual";

/** Commit manager configuration */
export interface CommitManagerConfig {
  /** Commit strategy */
  strategy: CommitStrategy;
  /** Batch interval in milliseconds (for batched strategy) */
  batchInterval: number;
  /** Maximum changes before auto-commit (for batched strategy) */
  maxBatchSize: number;
  /** Enable auto-commit on save */
  autoCommitOnSave: boolean;
  /** Default commit message prefix */
  messagePrefix?: string;
  /** Author name override */
  authorName?: string;
  /** Author email override */
  authorEmail?: string;
}

/** Commit message generation context */
export interface CommitContext {
  /** Primary action performed */
  action: "add" | "update" | "remove" | "refactor" | "fix" | "style";
  /** Main affected area/scope */
  scope: string;
  /** Detailed description */
  description: string;
  /** Breaking change flag */
  breaking?: boolean;
  /** Related issue/ticket */
  issue?: string;
}

/** Auto-commit event */
export interface CommitEvent {
  /** Event type */
  type: "commit_created" | "commit_failed" | "changes_batched" | "batch_committed";
  /** Commit (if successful) */
  commit?: GitCommit;
  /** Error message (if failed) */
  error?: string;
  /** Number of files affected */
  fileCount: number;
  /** Timestamp */
  timestamp: number;
}

/** Commit event listener */
export type CommitEventListener = (event: CommitEvent) => void;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: CommitManagerConfig = {
  strategy: "batched",
  batchInterval: 5000, // 5 seconds
  maxBatchSize: 10,
  autoCommitOnSave: true,
};

/** File extension to category mapping */
const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
  // Components
  tsx: "component",
  jsx: "component",
  vue: "component",
  svelte: "component",
  // Styles
  css: "style",
  scss: "style",
  sass: "style",
  less: "style",
  // Templates
  html: "template",
  xml: "template",
  ejs: "template",
  hbs: "template",
  // Config
  json: "config",
  yaml: "config",
  yml: "config",
  toml: "config",
  env: "config",
  // Assets
  png: "asset",
  jpg: "asset",
  jpeg: "asset",
  gif: "asset",
  svg: "asset",
  webp: "asset",
  ico: "asset",
  // Documentation
  md: "documentation",
  txt: "documentation",
  rst: "documentation",
  // Tests
  test: "test",
  spec: "test",
};

// =============================================================================
// CommitManager Class
// =============================================================================

/**
 * CommitManager handles auto-committing changes with meaningful messages.
 *
 * @example
 * ```typescript
 * const manager = new CommitManager(gitService, {
 *   strategy: "batched",
 *   batchInterval: 5000,
 *   autoCommitOnSave: true,
 * });
 *
 * // Track a file change
 * manager.trackChange({
 *   path: "components/Button.tsx",
 *   type: "modified",
 *   content: "...",
 * });
 *
 * // Changes will be auto-committed based on strategy
 *
 * // Or commit manually with context
 * await manager.commit({
 *   action: "add",
 *   scope: "components",
 *   description: "Add Button component with variants",
 * });
 * ```
 */
export class CommitManager {
  private gitService: GitService;
  private config: CommitManagerConfig;
  private pendingChanges: Map<string, FileChange> = new Map();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<CommitEventListener> = new Set();
  private isCommitting: boolean = false;

  constructor(gitService: GitService, config: Partial<CommitManagerConfig> = {}) {
    this.gitService = gitService;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Track a file change
   */
  trackChange(change: Omit<FileChange, "timestamp" | "category">): void {
    const category = this.categorizeFile(change.path);
    const fullChange: FileChange = {
      ...change,
      timestamp: Date.now(),
      category,
    };

    this.pendingChanges.set(change.path, fullChange);

    // Handle based on strategy
    if (this.config.strategy === "immediate" && this.config.autoCommitOnSave) {
      this.commitPendingChanges();
    } else if (this.config.strategy === "batched") {
      this.scheduleBatchCommit();
    }

    this.emit({
      type: "changes_batched",
      fileCount: this.pendingChanges.size,
      timestamp: Date.now(),
    });
  }

  /**
   * Track multiple file changes
   */
  trackChanges(changes: Array<Omit<FileChange, "timestamp" | "category">>): void {
    for (const change of changes) {
      const category = this.categorizeFile(change.path);
      this.pendingChanges.set(change.path, {
        ...change,
        timestamp: Date.now(),
        category,
      });
    }

    if (this.config.strategy === "immediate" && this.config.autoCommitOnSave) {
      this.commitPendingChanges();
    } else if (this.config.strategy === "batched") {
      this.scheduleBatchCommit();
    }
  }

  /**
   * Commit pending changes with auto-generated message
   */
  async commitPendingChanges(): Promise<GitOperationResult> {
    if (this.isCommitting || this.pendingChanges.size === 0) {
      return {
        success: false,
        message: this.isCommitting ? "Commit in progress" : "No pending changes",
      };
    }

    this.isCommitting = true;
    this.clearBatchTimer();

    try {
      const changes = Array.from(this.pendingChanges.values());
      const message = this.generateMessage(changes);
      const files = changes
        .filter((c) => c.type !== "deleted" && c.content)
        .map((c) => ({ path: c.path, content: c.content!, type: "xml" as const }));

      const result = this.gitService.saveChanges(files, message);

      if (result.success) {
        const commit = result.data?.commit as GitCommit | undefined;
        this.pendingChanges.clear();

        this.emit({
          type: "commit_created",
          commit,
          fileCount: changes.length,
          timestamp: Date.now(),
        });
      } else {
        this.emit({
          type: "commit_failed",
          error: result.error,
          fileCount: changes.length,
          timestamp: Date.now(),
        });
      }

      return result;
    } finally {
      this.isCommitting = false;
    }
  }

  /**
   * Commit with explicit context (manual commit)
   */
  async commit(context: CommitContext): Promise<GitOperationResult> {
    if (this.pendingChanges.size === 0) {
      return { success: false, message: "No pending changes" };
    }

    this.isCommitting = true;
    this.clearBatchTimer();

    try {
      const changes = Array.from(this.pendingChanges.values());
      const message = this.buildCommitMessage(context);
      const files = changes
        .filter((c) => c.type !== "deleted" && c.content)
        .map((c) => ({ path: c.path, content: c.content!, type: "xml" as const }));

      const result = this.gitService.saveChanges(files, message);

      if (result.success) {
        this.pendingChanges.clear();
        this.emit({
          type: "commit_created",
          commit: result.data?.commit as GitCommit,
          fileCount: changes.length,
          timestamp: Date.now(),
        });
      }

      return result;
    } finally {
      this.isCommitting = false;
    }
  }

  /**
   * Get pending changes
   */
  getPendingChanges(): FileChange[] {
    return Array.from(this.pendingChanges.values());
  }

  /**
   * Get pending change count
   */
  getPendingCount(): number {
    return this.pendingChanges.size;
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.pendingChanges.size > 0;
  }

  /**
   * Clear pending changes without committing
   */
  clearPendingChanges(): void {
    this.pendingChanges.clear();
    this.clearBatchTimer();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CommitManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CommitManagerConfig {
    return { ...this.config };
  }

  /**
   * Add event listener
   */
  on(listener: CommitEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearBatchTimer();
    this.listeners.clear();
    this.pendingChanges.clear();
  }

  // ==========================================================================
  // Message Generation
  // ==========================================================================

  /**
   * Generate commit message from changes
   */
  private generateMessage(changes: FileChange[]): string {
    const context = this.analyzeChanges(changes);
    return this.buildCommitMessage(context);
  }

  /**
   * Analyze changes to determine commit context
   */
  private analyzeChanges(changes: FileChange[]): CommitContext {
    // Count change types
    const typeCounts = {
      created: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
    };

    const categoryCounts: Record<FileCategory, number> = {
      component: 0,
      style: 0,
      template: 0,
      config: 0,
      asset: 0,
      documentation: 0,
      test: 0,
      other: 0,
    };

    for (const change of changes) {
      typeCounts[change.type]++;
      categoryCounts[change.category]++;
    }

    // Determine primary action
    let action: CommitContext["action"];
    if (typeCounts.created > typeCounts.modified) {
      action = "add";
    } else if (typeCounts.deleted > 0 && typeCounts.deleted >= typeCounts.modified) {
      action = "remove";
    } else {
      action = "update";
    }

    // Determine primary scope
    const primaryCategory = (Object.entries(categoryCounts) as [FileCategory, number][])
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "other";

    const scope = this.categoryToScope(primaryCategory);

    // Generate description
    const description = this.generateDescription(changes, action, primaryCategory);

    return { action, scope, description };
  }

  /**
   * Build commit message from context
   */
  private buildCommitMessage(context: CommitContext): string {
    const type = this.actionToCommitType(context.action);
    let message = generateCommitMessage(type, context.scope, context.description);

    if (this.config.messagePrefix) {
      message = `${this.config.messagePrefix} ${message}`;
    }

    if (context.breaking) {
      message = message.replace(
        `${type}(${context.scope}):`,
        `${type}(${context.scope})!:`
      );
    }

    if (context.issue) {
      message += `\n\nCloses ${context.issue}`;
    }

    return message;
  }

  /**
   * Generate description from changes
   */
  private generateDescription(
    changes: FileChange[],
    action: CommitContext["action"],
    category: FileCategory
  ): string {
    const fileCount = changes.length;

    if (fileCount === 1) {
      const change = changes[0];
      const fileName = change.path.split("/").pop() || change.path;
      const baseName = fileName.replace(/\.[^.]+$/, "");

      switch (action) {
        case "add":
          return `add ${baseName} ${category}`;
        case "remove":
          return `remove ${baseName} ${category}`;
        case "update":
          return `update ${baseName} ${category}`;
        case "fix":
          return `fix ${baseName} ${category}`;
        case "refactor":
          return `refactor ${baseName} ${category}`;
        case "style":
          return `style ${baseName} ${category}`;
      }
    }

    // Multiple files
    const actionVerb = {
      add: "add",
      remove: "remove",
      update: "update",
      fix: "fix",
      refactor: "refactor",
      style: "style",
    }[action];

    return `${actionVerb} ${fileCount} ${category} files`;
  }

  /**
   * Convert action to conventional commit type
   */
  private actionToCommitType(
    action: CommitContext["action"]
  ): "feat" | "fix" | "refactor" | "style" | "docs" | "chore" {
    switch (action) {
      case "add":
        return "feat";
      case "update":
        return "feat";
      case "remove":
        return "chore";
      case "fix":
        return "fix";
      case "refactor":
        return "refactor";
      case "style":
        return "style";
      default:
        return "chore";
    }
  }

  /**
   * Convert category to commit scope
   */
  private categoryToScope(category: FileCategory): string {
    const scopeMap: Record<FileCategory, string> = {
      component: "components",
      style: "styles",
      template: "templates",
      config: "config",
      asset: "assets",
      documentation: "docs",
      test: "tests",
      other: "misc",
    };
    return scopeMap[category];
  }

  // ==========================================================================
  // File Categorization
  // ==========================================================================

  /**
   * Categorize a file based on its path and extension
   */
  private categorizeFile(path: string): FileCategory {
    // Check for test files
    if (path.includes(".test.") || path.includes(".spec.") || path.includes("__tests__")) {
      return "test";
    }

    // Check for documentation
    if (path.includes("/docs/") || path.includes("/documentation/")) {
      return "documentation";
    }

    // Check extension
    const ext = path.split(".").pop()?.toLowerCase() || "";
    if (EXTENSION_CATEGORY_MAP[ext]) {
      return EXTENSION_CATEGORY_MAP[ext];
    }

    // Check path patterns
    if (path.includes("/components/") || path.includes("/ui/")) {
      return "component";
    }
    if (path.includes("/styles/") || path.includes("/css/")) {
      return "style";
    }
    if (path.includes("/templates/") || path.includes("/views/")) {
      return "template";
    }
    if (path.includes("/config/") || path.includes("/settings/")) {
      return "config";
    }
    if (path.includes("/assets/") || path.includes("/images/") || path.includes("/public/")) {
      return "asset";
    }

    return "other";
  }

  // ==========================================================================
  // Batch Management
  // ==========================================================================

  /**
   * Schedule a batch commit
   */
  private scheduleBatchCommit(): void {
    // Check if we should commit immediately due to batch size
    if (this.pendingChanges.size >= this.config.maxBatchSize) {
      this.commitPendingChanges();
      return;
    }

    // Clear existing timer and set new one
    this.clearBatchTimer();

    if (this.config.autoCommitOnSave) {
      this.batchTimer = setTimeout(() => {
        this.commitPendingChanges();
      }, this.config.batchInterval);
    }
  }

  /**
   * Clear batch timer
   */
  private clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // ==========================================================================
  // Event Emission
  // ==========================================================================

  /**
   * Emit an event to all listeners
   */
  private emit(event: CommitEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a CommitManager with default configuration
 */
export function createCommitManager(
  gitService: GitService,
  config?: Partial<CommitManagerConfig>
): CommitManager {
  return new CommitManager(gitService, config);
}

export default CommitManager;
