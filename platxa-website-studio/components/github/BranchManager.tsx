"use client";

/**
 * BranchManager Component
 *
 * Manage Git branches for feature development with create, switch, and merge capabilities.
 * Experimental feature for isolated feature development workflows.
 *
 * Features:
 * - Create new branches from current or specific commit
 * - Switch between branches
 * - Merge branches to main/target
 * - Delete branches (with safety checks)
 * - Branch comparison view
 * - Pull request creation integration
 * - Branch protection indicators
 * - Stash support for dirty working directory
 *
 * Feature #47: GitHub Integration - Branch support for feature development
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  GitBranch,
  GitMerge,
  GitPullRequest,
  Plus,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Shield,
  Clock,
  ArrowRight,
  ArrowLeftRight,
  Copy,
  MoreVertical,
  Star,
  StarOff,
  Lock,
  Unlock,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

/** Branch status */
export type BranchStatus = "current" | "active" | "merged" | "stale" | "protected";

/** Merge status */
export type MergeStatus = "clean" | "conflicts" | "behind" | "ahead" | "diverged";

/** Branch information */
export interface Branch {
  name: string;
  isDefault: boolean;
  isProtected: boolean;
  isCurrent: boolean;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
  aheadBehind?: {
    ahead: number;
    behind: number;
  };
  status: BranchStatus;
  mergeStatus?: MergeStatus;
  pullRequest?: {
    number: number;
    title: string;
    state: "open" | "closed" | "merged";
    url: string;
  };
}

/** Create branch options */
export interface CreateBranchOptions {
  name: string;
  fromBranch?: string;
  fromCommit?: string;
  checkout?: boolean;
}

/** Merge options */
export interface MergeOptions {
  sourceBranch: string;
  targetBranch: string;
  strategy?: "merge" | "squash" | "rebase";
  deleteAfterMerge?: boolean;
}

/** Component props */
export interface BranchManagerProps {
  /** List of branches */
  branches: Branch[];
  /** Current branch name */
  currentBranch: string;
  /** Default/main branch name */
  defaultBranch: string;
  /** Callback to create a new branch */
  onCreateBranch?: (options: CreateBranchOptions) => Promise<void>;
  /** Callback to switch branches */
  onSwitchBranch?: (branchName: string) => Promise<void>;
  /** Callback to merge branches */
  onMergeBranch?: (options: MergeOptions) => Promise<void>;
  /** Callback to delete a branch */
  onDeleteBranch?: (branchName: string) => Promise<void>;
  /** Callback to create a pull request */
  onCreatePullRequest?: (branchName: string) => Promise<void>;
  /** Callback to refresh branches */
  onRefresh?: () => Promise<void>;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Whether there are uncommitted changes */
  hasUncommittedChanges?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Sub-components
// =============================================================================

/** Create branch dialog */
interface CreateBranchDialogProps {
  branches: Branch[];
  defaultFromBranch: string;
  onSubmit: (options: CreateBranchOptions) => void;
  onCancel: () => void;
}

function CreateBranchDialog({
  branches,
  defaultFromBranch,
  onSubmit,
  onCancel,
}: CreateBranchDialogProps) {
  const [name, setName] = useState("");
  const [fromBranch, setFromBranch] = useState(defaultFromBranch);
  const [checkout, setCheckout] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validateName = (value: string): string | null => {
    if (!value.trim()) return "Branch name is required";
    if (!/^[a-zA-Z0-9._/-]+$/.test(value)) {
      return "Invalid characters in branch name";
    }
    if (branches.some((b) => b.name === value)) {
      return "Branch already exists";
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit({ name: name.trim(), fromBranch, checkout });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-card space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Create New Branch
      </h3>

      <div>
        <label className="text-sm font-medium">Branch Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="feature/my-new-feature"
          className={cn(
            "w-full mt-1 px-3 py-2 text-sm border rounded bg-background",
            error && "border-destructive"
          )}
          autoFocus
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">From Branch</label>
        <select
          value={fromBranch}
          onChange={(e) => setFromBranch(e.target.value)}
          className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
        >
          {branches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.name} {branch.isDefault && "(default)"}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="checkout"
          checked={checkout}
          onChange={(e) => setCheckout(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="checkout" className="text-sm">
          Switch to new branch after creation
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          <GitBranch className="h-4 w-4" />
          Create Branch
        </button>
      </div>
    </form>
  );
}

/** Merge branch dialog */
interface MergeBranchDialogProps {
  sourceBranch: Branch;
  targetBranches: Branch[];
  defaultTarget: string;
  onSubmit: (options: MergeOptions) => void;
  onCancel: () => void;
}

function MergeBranchDialog({
  sourceBranch,
  targetBranches,
  defaultTarget,
  onSubmit,
  onCancel,
}: MergeBranchDialogProps) {
  const [targetBranch, setTargetBranch] = useState(defaultTarget);
  const [strategy, setStrategy] = useState<"merge" | "squash" | "rebase">("merge");
  const [deleteAfterMerge, setDeleteAfterMerge] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      sourceBranch: sourceBranch.name,
      targetBranch,
      strategy,
      deleteAfterMerge,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-card space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <GitMerge className="h-4 w-4" />
        Merge Branch
      </h3>

      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex-1 text-center">
          <div className="text-xs text-muted-foreground mb-1">From</div>
          <div className="font-mono text-sm">{sourceBranch.name}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 text-center">
          <div className="text-xs text-muted-foreground mb-1">Into</div>
          <select
            value={targetBranch}
            onChange={(e) => setTargetBranch(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-background font-mono"
          >
            {targetBranches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Merge Strategy</label>
        <div className="mt-2 space-y-2">
          {[
            { value: "merge", label: "Create merge commit", desc: "Preserves all commit history" },
            { value: "squash", label: "Squash and merge", desc: "Combines all commits into one" },
            { value: "rebase", label: "Rebase and merge", desc: "Linear history, no merge commit" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors",
                strategy === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <input
                type="radio"
                name="strategy"
                value={opt.value}
                checked={strategy === opt.value}
                onChange={(e) => setStrategy(e.target.value as typeof strategy)}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="deleteAfterMerge"
          checked={deleteAfterMerge}
          onChange={(e) => setDeleteAfterMerge(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="deleteAfterMerge" className="text-sm">
          Delete source branch after merge
        </label>
      </div>

      {sourceBranch.mergeStatus === "conflicts" && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <div>
            <div className="font-medium text-yellow-700 dark:text-yellow-400">
              Conflicts detected
            </div>
            <div className="text-yellow-600 dark:text-yellow-500">
              You may need to resolve conflicts before merging
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          <GitMerge className="h-4 w-4" />
          Merge
        </button>
      </div>
    </form>
  );
}

/** Branch list item */
interface BranchItemProps {
  branch: Branch;
  isCurrent: boolean;
  onSwitch: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onCreatePR: () => void;
}

function BranchItem({
  branch,
  isCurrent,
  onSwitch,
  onMerge,
  onDelete,
  onCreatePR,
}: BranchItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const statusColors: Record<BranchStatus, string> = {
    current: "text-green-600 bg-green-100 dark:bg-green-900/30",
    active: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    merged: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
    stale: "text-gray-600 bg-gray-100 dark:bg-gray-900/30",
    protected: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        isCurrent ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      )}
    >
      {/* Branch icon */}
      <GitBranch className={cn("h-5 w-5", isCurrent ? "text-primary" : "text-muted-foreground")} />

      {/* Branch info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium truncate">{branch.name}</span>
          {branch.isDefault && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded">
              default
            </span>
          )}
          {branch.isProtected && (
            <Shield className="h-3.5 w-3.5 text-yellow-600" title="Protected branch" />
          )}
          {isCurrent && (
            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded">
              current
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="truncate max-w-[200px]">{branch.lastCommit.message}</span>
          <span>•</span>
          <span>{branch.lastCommit.author}</span>
        </div>
      </div>

      {/* Ahead/behind indicator */}
      {branch.aheadBehind && (branch.aheadBehind.ahead > 0 || branch.aheadBehind.behind > 0) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {branch.aheadBehind.ahead > 0 && (
            <span className="text-green-600">↑{branch.aheadBehind.ahead}</span>
          )}
          {branch.aheadBehind.behind > 0 && (
            <span className="text-red-600">↓{branch.aheadBehind.behind}</span>
          )}
        </div>
      )}

      {/* PR indicator */}
      {branch.pullRequest && (
        <a
          href={branch.pullRequest.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
            branch.pullRequest.state === "open"
              ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
              : branch.pullRequest.state === "merged"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
          )}
        >
          <GitPullRequest className="h-3 w-3" />
          #{branch.pullRequest.number}
        </a>
      )}

      {/* Actions */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-popover border rounded-lg shadow-lg py-1">
              {!isCurrent && (
                <button
                  onClick={() => {
                    onSwitch();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Switch to branch
                </button>
              )}
              {!branch.isDefault && (
                <button
                  onClick={() => {
                    onMerge();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                >
                  <GitMerge className="h-4 w-4" />
                  Merge branch
                </button>
              )}
              {!branch.pullRequest && !branch.isDefault && (
                <button
                  onClick={() => {
                    onCreatePR();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                >
                  <GitPullRequest className="h-4 w-4" />
                  Create pull request
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(branch.name);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <Copy className="h-4 w-4" />
                Copy branch name
              </button>
              {!branch.isDefault && !branch.isProtected && !isCurrent && (
                <>
                  <div className="border-t my-1" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete branch
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function BranchManager({
  branches,
  currentBranch,
  defaultBranch,
  onCreateBranch,
  onSwitchBranch,
  onMergeBranch,
  onDeleteBranch,
  onCreatePullRequest,
  onRefresh,
  isLoading = false,
  hasUncommittedChanges = false,
  className,
}: BranchManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [mergingBranch, setMergingBranch] = useState<Branch | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "merged" | "stale">("all");

  // Filter branches
  const filteredBranches = useMemo(() => {
    let result = branches;

    // Filter by status
    if (filter !== "all") {
      result = result.filter((b) => b.status === filter);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.lastCommit.message.toLowerCase().includes(query)
      );
    }

    // Sort: current first, then default, then by last commit date
    return result.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return new Date(b.lastCommit.date).getTime() - new Date(a.lastCommit.date).getTime();
    });
  }, [branches, filter, searchQuery]);

  // Target branches for merge (exclude source)
  const getTargetBranches = (source: Branch) =>
    branches.filter((b) => b.name !== source.name);

  // Handlers
  const handleCreateBranch = useCallback(
    async (options: CreateBranchOptions) => {
      await onCreateBranch?.(options);
      setShowCreateDialog(false);
    },
    [onCreateBranch]
  );

  const handleMergeBranch = useCallback(
    async (options: MergeOptions) => {
      await onMergeBranch?.(options);
      setMergingBranch(null);
    },
    [onMergeBranch]
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Branch Manager</h2>
            <p className="text-xs text-muted-foreground">
              {branches.length} branch{branches.length !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
          )}
          {onCreateBranch && (
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Branch
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-b">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search branches..."
          className="flex-1 px-3 py-2 text-sm border rounded bg-background"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-3 py-2 text-sm border rounded bg-background"
        >
          <option value="all">All branches</option>
          <option value="active">Active</option>
          <option value="merged">Merged</option>
          <option value="stale">Stale</option>
        </select>
      </div>

      {/* Uncommitted changes warning */}
      {hasUncommittedChanges && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-950/30 text-sm text-yellow-700 dark:text-yellow-400 border-b">
          <AlertTriangle className="h-4 w-4" />
          You have uncommitted changes. Commit or stash before switching branches.
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Create branch dialog */}
        {showCreateDialog && (
          <div className="mb-4">
            <CreateBranchDialog
              branches={branches}
              defaultFromBranch={currentBranch}
              onSubmit={handleCreateBranch}
              onCancel={() => setShowCreateDialog(false)}
            />
          </div>
        )}

        {/* Merge dialog */}
        {mergingBranch && (
          <div className="mb-4">
            <MergeBranchDialog
              sourceBranch={mergingBranch}
              targetBranches={getTargetBranches(mergingBranch)}
              defaultTarget={defaultBranch}
              onSubmit={handleMergeBranch}
              onCancel={() => setMergingBranch(null)}
            />
          </div>
        )}

        {/* Branch list */}
        {filteredBranches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-muted-foreground">No branches found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Try a different search" : "Create a new branch to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBranches.map((branch) => (
              <BranchItem
                key={branch.name}
                branch={branch}
                isCurrent={branch.name === currentBranch}
                onSwitch={() => onSwitchBranch?.(branch.name)}
                onMerge={() => setMergingBranch(branch)}
                onDelete={() => onDeleteBranch?.(branch.name)}
                onCreatePR={() => onCreatePullRequest?.(branch.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>
          Current: <span className="font-mono">{currentBranch}</span>
        </span>
        <span>
          Default: <span className="font-mono">{defaultBranch}</span>
        </span>
      </div>
    </div>
  );
}

export default BranchManager;
