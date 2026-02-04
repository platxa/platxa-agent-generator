/**
 * GitHubSync — Bidirectional sync between Platxa and GitHub
 *
 * Feature #42: GitHub Integration
 *
 * Handles synchronization between Platxa projects and GitHub repositories:
 * - Push local changes to GitHub
 * - Pull remote changes from GitHub
 * - Conflict detection and resolution
 * - Branch management
 * - Webhook event handling
 */

// =============================================================================
// Types
// =============================================================================

/** GitHub authentication configuration */
export interface GitHubAuth {
  /** Personal access token or OAuth token */
  token: string;
  /** Token type (default: "token") */
  type?: "token" | "bearer";
}

/** Repository reference */
export interface RepoRef {
  /** Repository owner (user or organization) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Branch name (default: "main") */
  branch?: string;
}

/** File change entry */
export interface FileChange {
  /** File path relative to repo root */
  path: string;
  /** Change type */
  type: "add" | "modify" | "delete";
  /** File content (base64 for binary, utf-8 for text) */
  content?: string;
  /** Whether content is binary */
  binary?: boolean;
  /** SHA of the blob (for updates/deletes) */
  sha?: string;
}

/** Sync direction */
export type SyncDirection = "push" | "pull" | "bidirectional";

/** Sync status */
export type SyncStatus =
  | "idle"
  | "syncing"
  | "conflict"
  | "error"
  | "up-to-date";

/** Conflict entry */
export interface SyncConflict {
  /** Conflicting file path */
  path: string;
  /** Local version content */
  localContent: string;
  /** Remote version content */
  remoteContent: string;
  /** Local last modified timestamp */
  localModified: number;
  /** Remote last modified timestamp */
  remoteModified: number;
}

/** Sync result */
export interface SyncResult {
  /** Whether sync was successful */
  success: boolean;
  /** Sync direction performed */
  direction: SyncDirection;
  /** Files pushed to remote */
  pushed: string[];
  /** Files pulled from remote */
  pulled: string[];
  /** Conflicts detected */
  conflicts: SyncConflict[];
  /** Error message if failed */
  error?: string;
  /** Commit SHA created (if pushed) */
  commitSha?: string;
  /** Timestamp of sync */
  timestamp: number;
}

/** Webhook event types */
export type WebhookEventType =
  | "push"
  | "pull_request"
  | "create"
  | "delete";

/** Webhook payload (simplified) */
export interface WebhookPayload {
  /** Event type */
  event: WebhookEventType;
  /** Repository info */
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
  /** Ref (branch/tag) */
  ref?: string;
  /** Commits (for push events) */
  commits?: Array<{
    sha: string;
    message: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  /** Sender info */
  sender: {
    login: string;
    id: number;
  };
}

/** GitHubSync configuration */
export interface GitHubSyncConfig {
  /** GitHub API base URL */
  apiUrl: string;
  /** Default branch */
  defaultBranch: string;
  /** Auto-sync on changes */
  autoSync: boolean;
  /** Auto-sync debounce interval (ms) */
  autoSyncDebounce: number;
  /** Commit message template */
  commitMessageTemplate: string;
  /** Author name for commits */
  authorName: string;
  /** Author email for commits */
  authorEmail: string;
  /** Conflict resolution strategy */
  conflictStrategy: "manual" | "local" | "remote";
  /** File patterns to exclude from sync */
  excludePatterns: string[];
}

/** Sync state */
export interface GitHubSyncState {
  /** Current sync status */
  status: SyncStatus;
  /** Connected repository */
  repo: RepoRef | null;
  /** Last successful sync */
  lastSync: SyncResult | null;
  /** Pending local changes */
  pendingChanges: FileChange[];
  /** Current conflicts */
  conflicts: SyncConflict[];
  /** Sync in progress */
  isSyncing: boolean;
  /** Last error */
  lastError: string | null;
}

/** Event types */
export type GitHubSyncEventType =
  | "status_change"
  | "sync_start"
  | "sync_complete"
  | "sync_error"
  | "conflict_detected"
  | "conflict_resolved"
  | "change_detected"
  | "webhook_received";

/** Event payload */
export interface GitHubSyncEvent {
  type: GitHubSyncEventType;
  timestamp: number;
  data: unknown;
}

/** Event listener */
export type GitHubSyncEventListener = (event: GitHubSyncEvent) => void;

/** GitHub API adapter (for testing/mocking) */
export interface GitHubApiAdapter {
  /** Get repository info */
  getRepo(auth: GitHubAuth, ref: RepoRef): Promise<{ defaultBranch: string; private: boolean }>;
  /** Get file content */
  getContent(auth: GitHubAuth, ref: RepoRef, path: string): Promise<{ content: string; sha: string } | null>;
  /** Get tree (directory listing) */
  getTree(auth: GitHubAuth, ref: RepoRef, path?: string): Promise<Array<{ path: string; type: "blob" | "tree"; sha: string }>>;
  /** Create or update file */
  createOrUpdateFile(
    auth: GitHubAuth,
    ref: RepoRef,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<{ sha: string; commitSha: string }>;
  /** Delete file */
  deleteFile(
    auth: GitHubAuth,
    ref: RepoRef,
    path: string,
    message: string,
    sha: string
  ): Promise<{ commitSha: string }>;
  /** Create commit with multiple files */
  createCommit(
    auth: GitHubAuth,
    ref: RepoRef,
    message: string,
    changes: FileChange[]
  ): Promise<{ sha: string }>;
  /** Get latest commit SHA */
  getLatestCommit(auth: GitHubAuth, ref: RepoRef): Promise<string>;
  /** Compare commits */
  compareCommits(
    auth: GitHubAuth,
    ref: RepoRef,
    base: string,
    head: string
  ): Promise<{ ahead: number; behind: number; files: Array<{ filename: string; status: string }> }>;
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_GITHUB_SYNC_CONFIG: GitHubSyncConfig = {
  apiUrl: "https://api.github.com",
  defaultBranch: "main",
  autoSync: false,
  autoSyncDebounce: 5000,
  commitMessageTemplate: "Update from Platxa: {timestamp}",
  authorName: "Platxa Bot",
  authorEmail: "bot@platxa.com",
  conflictStrategy: "manual",
  excludePatterns: [
    ".git/**",
    "node_modules/**",
    ".env*",
    "*.log",
  ],
};

// =============================================================================
// Default HTTP API Adapter
// =============================================================================

/** Create default GitHub API adapter using fetch */
function createDefaultApiAdapter(): GitHubApiAdapter {
  const headers = (auth: GitHubAuth) => ({
    "Authorization": `${auth.type || "token"} ${auth.token}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  });

  const apiUrl = (config: GitHubSyncConfig, path: string) =>
    `${config.apiUrl}${path}`;

  return {
    async getRepo(auth, ref) {
      const url = apiUrl(DEFAULT_GITHUB_SYNC_CONFIG, `/repos/${ref.owner}/${ref.repo}`);
      const res = await fetch(url, { headers: headers(auth) });
      if (!res.ok) throw new Error(`Failed to get repo: ${res.statusText}`);
      const data = await res.json();
      return { defaultBranch: data.default_branch, private: data.private };
    },

    async getContent(auth, ref, path) {
      const branch = ref.branch || DEFAULT_GITHUB_SYNC_CONFIG.defaultBranch;
      const url = apiUrl(
        DEFAULT_GITHUB_SYNC_CONFIG,
        `/repos/${ref.owner}/${ref.repo}/contents/${path}?ref=${branch}`
      );
      const res = await fetch(url, { headers: headers(auth) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Failed to get content: ${res.statusText}`);
      const data = await res.json();
      return {
        content: Buffer.from(data.content, "base64").toString("utf-8"),
        sha: data.sha,
      };
    },

    async getTree(auth, ref, path) {
      const branch = ref.branch || DEFAULT_GITHUB_SYNC_CONFIG.defaultBranch;
      const url = apiUrl(
        DEFAULT_GITHUB_SYNC_CONFIG,
        `/repos/${ref.owner}/${ref.repo}/git/trees/${branch}?recursive=1`
      );
      const res = await fetch(url, { headers: headers(auth) });
      if (!res.ok) throw new Error(`Failed to get tree: ${res.statusText}`);
      const data = await res.json();
      const items = data.tree as Array<{ path: string; type: string; sha: string }>;
      const filtered = path
        ? items.filter((i) => i.path.startsWith(path))
        : items;
      return filtered.map((i) => ({
        path: i.path,
        type: i.type as "blob" | "tree",
        sha: i.sha,
      }));
    },

    async createOrUpdateFile(auth, ref, path, content, message, sha) {
      const branch = ref.branch || DEFAULT_GITHUB_SYNC_CONFIG.defaultBranch;
      const url = apiUrl(
        DEFAULT_GITHUB_SYNC_CONFIG,
        `/repos/${ref.owner}/${ref.repo}/contents/${path}`
      );
      const body: Record<string, unknown> = {
        message,
        content: Buffer.from(content).toString("base64"),
        branch,
      };
      if (sha) body.sha = sha;

      const res = await fetch(url, {
        method: "PUT",
        headers: headers(auth),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to create/update file: ${res.statusText}`);
      const data = await res.json();
      return { sha: data.content.sha, commitSha: data.commit.sha };
    },

    async deleteFile(auth, ref, path, message, sha) {
      const branch = ref.branch || DEFAULT_GITHUB_SYNC_CONFIG.defaultBranch;
      const url = apiUrl(
        DEFAULT_GITHUB_SYNC_CONFIG,
        `/repos/${ref.owner}/${ref.repo}/contents/${path}`
      );
      const res = await fetch(url, {
        method: "DELETE",
        headers: headers(auth),
        body: JSON.stringify({ message, sha, branch }),
      });
      if (!res.ok) throw new Error(`Failed to delete file: ${res.statusText}`);
      const data = await res.json();
      return { commitSha: data.commit.sha };
    },

    async createCommit(auth, ref, message, changes) {
      // For multiple files, we need to use the Git Data API
      // This is a simplified implementation that creates individual file commits
      // A proper implementation would use trees and blobs
      const branch = ref.branch || DEFAULT_GITHUB_SYNC_CONFIG.defaultBranch;
      let lastCommitSha = "";

      for (const change of changes) {
        if (change.type === "delete" && change.sha) {
          const result = await this.deleteFile(auth, ref, change.path, message, change.sha);
          lastCommitSha = result.commitSha;
        } else if (change.content) {
          const result = await this.createOrUpdateFile(
            auth,
            ref,
            change.path,
            change.content,
            message,
            change.sha
          );
          lastCommitSha = result.commitSha;
        }
      }

      return { sha: lastCommitSha };
    },

    async getLatestCommit(auth, ref) {
      const branch = ref.branch || DEFAULT_GITHUB_SYNC_CONFIG.defaultBranch;
      const url = apiUrl(
        DEFAULT_GITHUB_SYNC_CONFIG,
        `/repos/${ref.owner}/${ref.repo}/commits/${branch}`
      );
      const res = await fetch(url, { headers: headers(auth) });
      if (!res.ok) throw new Error(`Failed to get latest commit: ${res.statusText}`);
      const data = await res.json();
      return data.sha;
    },

    async compareCommits(auth, ref, base, head) {
      const url = apiUrl(
        DEFAULT_GITHUB_SYNC_CONFIG,
        `/repos/${ref.owner}/${ref.repo}/compare/${base}...${head}`
      );
      const res = await fetch(url, { headers: headers(auth) });
      if (!res.ok) throw new Error(`Failed to compare commits: ${res.statusText}`);
      const data = await res.json();
      return {
        ahead: data.ahead_by,
        behind: data.behind_by,
        files: data.files.map((f: { filename: string; status: string }) => ({
          filename: f.filename,
          status: f.status,
        })),
      };
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

/** Check if path matches any exclude pattern */
function isExcluded(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Simple glob matching
    const regex = new RegExp(
      "^" + pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$"
    );
    if (regex.test(path)) return true;
  }
  return false;
}

/** Generate commit message from template */
function generateCommitMessage(template: string, context: Record<string, string>): string {
  let message = template;
  for (const [key, value] of Object.entries(context)) {
    message = message.replace(`{${key}}`, value);
  }
  return message;
}

// =============================================================================
// GitHubSync Class
// =============================================================================

/**
 * GitHubSync manages bidirectional synchronization between Platxa and GitHub.
 *
 * Usage:
 * ```ts
 * const sync = new GitHubSync();
 *
 * // Connect to repository
 * await sync.connect(
 *   { token: "ghp_xxx" },
 *   { owner: "user", repo: "my-theme", branch: "main" }
 * );
 *
 * // Track local changes
 * sync.trackChange({ path: "views/index.xml", type: "modify", content: "..." });
 *
 * // Push changes to GitHub
 * const result = await sync.push("Update hero section");
 *
 * // Pull changes from GitHub
 * const pullResult = await sync.pull();
 *
 * // Handle conflicts
 * if (pullResult.conflicts.length > 0) {
 *   sync.resolveConflict(pullResult.conflicts[0].path, "local");
 * }
 * ```
 */
export class GitHubSync {
  private config: GitHubSyncConfig;
  private state: GitHubSyncState;
  private auth: GitHubAuth | null = null;
  private api: GitHubApiAdapter;
  private listeners: GitHubSyncEventListener[] = [];
  private autoSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  private localCommitSha: string | null = null;

  constructor(
    config: Partial<GitHubSyncConfig> = {},
    api?: GitHubApiAdapter
  ) {
    this.config = { ...DEFAULT_GITHUB_SYNC_CONFIG, ...config };
    this.api = api || createDefaultApiAdapter();
    this.state = {
      status: "idle",
      repo: null,
      lastSync: null,
      pendingChanges: [],
      conflicts: [],
      isSyncing: false,
      lastError: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Connect to a GitHub repository.
   */
  async connect(auth: GitHubAuth, repo: RepoRef): Promise<boolean> {
    try {
      this.auth = auth;

      // Validate repository access
      const repoInfo = await this.api.getRepo(auth, repo);

      // Set repo with default branch if not specified
      this.state.repo = {
        ...repo,
        branch: repo.branch || repoInfo.defaultBranch,
      };

      // Get latest commit SHA
      this.localCommitSha = await this.api.getLatestCommit(auth, this.state.repo);

      this.updateStatus("up-to-date");
      this.emit("status_change", { status: "up-to-date", repo: this.state.repo });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      this.state.lastError = message;
      this.updateStatus("error");
      this.emit("sync_error", { error: message });
      return false;
    }
  }

  /**
   * Disconnect from the repository.
   */
  disconnect(): void {
    this.auth = null;
    this.state.repo = null;
    this.localCommitSha = null;
    this.state.pendingChanges = [];
    this.state.conflicts = [];
    this.updateStatus("idle");
    this.cancelAutoSync();
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.auth !== null && this.state.repo !== null;
  }

  // ---------------------------------------------------------------------------
  // Change Tracking
  // ---------------------------------------------------------------------------

  /**
   * Track a local file change.
   */
  trackChange(change: FileChange): void {
    if (isExcluded(change.path, this.config.excludePatterns)) {
      return;
    }

    // Update or add change
    const existingIndex = this.state.pendingChanges.findIndex(
      (c) => c.path === change.path
    );

    if (existingIndex >= 0) {
      // If adding then deleting, remove from pending
      if (change.type === "delete" && this.state.pendingChanges[existingIndex].type === "add") {
        this.state.pendingChanges.splice(existingIndex, 1);
      } else {
        this.state.pendingChanges[existingIndex] = change;
      }
    } else {
      this.state.pendingChanges.push(change);
    }

    this.emit("change_detected", { change });

    // Trigger auto-sync if enabled
    if (this.config.autoSync && this.isConnected()) {
      this.scheduleAutoSync();
    }
  }

  /**
   * Clear pending changes.
   */
  clearPendingChanges(): void {
    this.state.pendingChanges = [];
  }

  /**
   * Get pending changes.
   */
  getPendingChanges(): FileChange[] {
    return [...this.state.pendingChanges];
  }

  // ---------------------------------------------------------------------------
  // Push
  // ---------------------------------------------------------------------------

  /**
   * Push local changes to GitHub.
   */
  async push(message?: string): Promise<SyncResult> {
    if (!this.auth || !this.state.repo) {
      return this.createErrorResult("push", "Not connected to repository");
    }

    if (this.state.pendingChanges.length === 0) {
      return {
        success: true,
        direction: "push",
        pushed: [],
        pulled: [],
        conflicts: [],
        timestamp: Date.now(),
      };
    }

    this.updateStatus("syncing");
    this.emit("sync_start", { direction: "push" });

    try {
      // Generate commit message
      const commitMessage = message || generateCommitMessage(
        this.config.commitMessageTemplate,
        { timestamp: new Date().toISOString() }
      );

      // Create commit with all changes
      const result = await this.api.createCommit(
        this.auth,
        this.state.repo,
        commitMessage,
        this.state.pendingChanges
      );

      // Update local commit SHA
      this.localCommitSha = result.sha;

      // Record pushed files
      const pushedFiles = this.state.pendingChanges.map((c) => c.path);

      // Clear pending changes
      this.state.pendingChanges = [];

      const syncResult: SyncResult = {
        success: true,
        direction: "push",
        pushed: pushedFiles,
        pulled: [],
        conflicts: [],
        commitSha: result.sha,
        timestamp: Date.now(),
      };

      this.state.lastSync = syncResult;
      this.updateStatus("up-to-date");
      this.emit("sync_complete", syncResult);

      return syncResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push failed";
      return this.createErrorResult("push", message);
    }
  }

  // ---------------------------------------------------------------------------
  // Pull
  // ---------------------------------------------------------------------------

  /**
   * Pull changes from GitHub.
   */
  async pull(): Promise<SyncResult> {
    if (!this.auth || !this.state.repo) {
      return this.createErrorResult("pull", "Not connected to repository");
    }

    this.updateStatus("syncing");
    this.emit("sync_start", { direction: "pull" });

    try {
      // Get latest commit
      const remoteCommitSha = await this.api.getLatestCommit(this.auth, this.state.repo);

      // If we're up to date, return early
      if (remoteCommitSha === this.localCommitSha) {
        const result: SyncResult = {
          success: true,
          direction: "pull",
          pushed: [],
          pulled: [],
          conflicts: [],
          timestamp: Date.now(),
        };
        this.updateStatus("up-to-date");
        this.emit("sync_complete", result);
        return result;
      }

      // Compare commits to find changed files
      const comparison = await this.api.compareCommits(
        this.auth,
        this.state.repo,
        this.localCommitSha || "HEAD~1",
        remoteCommitSha
      );

      const pulledFiles: string[] = [];
      const conflicts: SyncConflict[] = [];

      // Check each changed file for conflicts with local changes
      for (const file of comparison.files) {
        const localChange = this.state.pendingChanges.find(
          (c) => c.path === file.filename
        );

        if (localChange) {
          // Potential conflict
          const remoteContent = await this.api.getContent(
            this.auth,
            this.state.repo,
            file.filename
          );

          if (remoteContent && localChange.content !== remoteContent.content) {
            conflicts.push({
              path: file.filename,
              localContent: localChange.content || "",
              remoteContent: remoteContent.content,
              localModified: Date.now(),
              remoteModified: Date.now(),
            });
          }
        } else {
          pulledFiles.push(file.filename);
        }
      }

      // Handle conflicts based on strategy
      if (conflicts.length > 0) {
        if (this.config.conflictStrategy === "manual") {
          this.state.conflicts = conflicts;
          this.updateStatus("conflict");
          this.emit("conflict_detected", { conflicts });
        } else if (this.config.conflictStrategy === "remote") {
          // Auto-resolve: keep remote
          for (const conflict of conflicts) {
            const idx = this.state.pendingChanges.findIndex(
              (c) => c.path === conflict.path
            );
            if (idx >= 0) {
              this.state.pendingChanges.splice(idx, 1);
            }
            pulledFiles.push(conflict.path);
          }
          conflicts.length = 0;
        }
        // For "local" strategy, we keep local changes and ignore remote
      }

      // Update local commit SHA
      this.localCommitSha = remoteCommitSha;

      const syncResult: SyncResult = {
        success: conflicts.length === 0,
        direction: "pull",
        pushed: [],
        pulled: pulledFiles,
        conflicts,
        timestamp: Date.now(),
      };

      this.state.lastSync = syncResult;

      if (conflicts.length === 0) {
        this.updateStatus("up-to-date");
      }

      this.emit("sync_complete", syncResult);
      return syncResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pull failed";
      return this.createErrorResult("pull", message);
    }
  }

  // ---------------------------------------------------------------------------
  // Bidirectional Sync
  // ---------------------------------------------------------------------------

  /**
   * Perform bidirectional sync (pull then push).
   */
  async sync(): Promise<SyncResult> {
    // First pull
    const pullResult = await this.pull();

    if (!pullResult.success || pullResult.conflicts.length > 0) {
      return pullResult;
    }

    // Then push
    const pushResult = await this.push();

    return {
      success: pushResult.success,
      direction: "bidirectional",
      pushed: pushResult.pushed,
      pulled: pullResult.pulled,
      conflicts: [],
      commitSha: pushResult.commitSha,
      timestamp: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Conflict Resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve a conflict.
   */
  resolveConflict(path: string, resolution: "local" | "remote"): boolean {
    const conflictIndex = this.state.conflicts.findIndex((c) => c.path === path);

    if (conflictIndex < 0) {
      return false;
    }

    const conflict = this.state.conflicts[conflictIndex];

    if (resolution === "remote") {
      // Remove from pending changes (accept remote)
      const changeIndex = this.state.pendingChanges.findIndex(
        (c) => c.path === path
      );
      if (changeIndex >= 0) {
        this.state.pendingChanges.splice(changeIndex, 1);
      }
    }
    // For "local", we keep the pending change

    // Remove from conflicts
    this.state.conflicts.splice(conflictIndex, 1);

    this.emit("conflict_resolved", { path, resolution });

    // Update status if no more conflicts
    if (this.state.conflicts.length === 0) {
      this.updateStatus("up-to-date");
    }

    return true;
  }

  /**
   * Resolve all conflicts.
   */
  resolveAllConflicts(resolution: "local" | "remote"): void {
    const paths = this.state.conflicts.map((c) => c.path);
    for (const path of paths) {
      this.resolveConflict(path, resolution);
    }
  }

  /**
   * Get current conflicts.
   */
  getConflicts(): SyncConflict[] {
    return [...this.state.conflicts];
  }

  // ---------------------------------------------------------------------------
  // Webhook Handling
  // ---------------------------------------------------------------------------

  /**
   * Handle incoming webhook event.
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    this.emit("webhook_received", payload);

    // Only handle push events to our connected repo
    if (!this.state.repo) return;

    if (
      payload.event === "push" &&
      payload.repository.owner === this.state.repo.owner &&
      payload.repository.name === this.state.repo.repo
    ) {
      // Auto-pull on remote changes
      if (this.config.autoSync) {
        await this.pull();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-Sync
  // ---------------------------------------------------------------------------

  private scheduleAutoSync(): void {
    this.cancelAutoSync();

    this.autoSyncTimeout = setTimeout(async () => {
      if (this.isConnected() && this.state.pendingChanges.length > 0) {
        await this.sync();
      }
    }, this.config.autoSyncDebounce);
  }

  private cancelAutoSync(): void {
    if (this.autoSyncTimeout) {
      clearTimeout(this.autoSyncTimeout);
      this.autoSyncTimeout = null;
    }
  }

  // ---------------------------------------------------------------------------
  // State & Events
  // ---------------------------------------------------------------------------

  /**
   * Get current state.
   */
  getState(): GitHubSyncState {
    return { ...this.state };
  }

  /**
   * Get current status.
   */
  getStatus(): SyncStatus {
    return this.state.status;
  }

  /**
   * Add event listener.
   */
  on(listener: GitHubSyncEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(type: GitHubSyncEventType, data: unknown): void {
    const event: GitHubSyncEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  private updateStatus(status: SyncStatus): void {
    this.state.status = status;
    this.state.isSyncing = status === "syncing";
  }

  private createErrorResult(direction: SyncDirection, error: string): SyncResult {
    this.state.lastError = error;
    this.updateStatus("error");
    this.emit("sync_error", { error });

    return {
      success: false,
      direction,
      pushed: [],
      pulled: [],
      conflicts: [],
      error,
      timestamp: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Get configuration.
   */
  getConfig(): GitHubSyncConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<GitHubSyncConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: GitHubSync | null = null;

/** Get the global GitHubSync instance */
export function getGitHubSync(): GitHubSync {
  if (!_instance) {
    _instance = new GitHubSync();
  }
  return _instance;
}

/** Reset the global GitHubSync instance */
export function resetGitHubSync(): void {
  if (_instance) {
    _instance.disconnect();
  }
  _instance = null;
}
