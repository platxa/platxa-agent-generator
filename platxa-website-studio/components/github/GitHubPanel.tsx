"use client";

/**
 * GitHubPanel - Repository connection and sync management
 *
 * Provides UI for:
 * - Repository connection status display
 * - Last sync time indicator
 * - Sync status with progress
 * - Manual sync controls
 *
 * Feature #45: GitHub Integration - GitHubPanel UI
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  Check,
  Clock,
  GitBranch,
  Github,
  Loader2,
  RefreshCw,
  Unplug,
  Link as LinkIcon,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** Repository connection status */
export type ConnectionStatus = "connected" | "disconnected" | "error";

/** Sync operation status */
export type SyncStatus = "idle" | "syncing" | "success" | "error";

/** Connected repository info */
export interface RepoInfo {
  /** Repository owner (user or org) */
  owner: string;
  /** Repository name */
  name: string;
  /** Full repository URL */
  url: string;
  /** Default branch */
  defaultBranch: string;
  /** Current branch */
  currentBranch: string;
  /** Is private repository */
  isPrivate: boolean;
}

/** Sync state information */
export interface SyncState {
  /** Current sync status */
  status: SyncStatus;
  /** Last successful sync timestamp */
  lastSyncTime: Date | null;
  /** Number of pending changes */
  pendingChanges: number;
  /** Commits ahead of remote */
  ahead: number;
  /** Commits behind remote */
  behind: number;
  /** Error message if sync failed */
  error?: string;
}

/** GitHubPanel props */
export interface GitHubPanelProps {
  /** Connection status */
  connectionStatus: ConnectionStatus;
  /** Connected repository info */
  repo?: RepoInfo;
  /** Sync state */
  syncState: SyncState;
  /** Callback when connect is clicked */
  onConnect?: () => void;
  /** Callback when disconnect is clicked */
  onDisconnect?: () => void;
  /** Callback when sync is clicked */
  onSync?: () => Promise<void>;
  /** Callback when pull is clicked */
  onPull?: () => Promise<void>;
  /** Callback when push is clicked */
  onPush?: () => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

/**
 * Get status color class
 */
function getStatusColor(status: SyncStatus): string {
  switch (status) {
    case "syncing":
      return "text-blue-500";
    case "success":
      return "text-green-500";
    case "error":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

// =============================================================================
// Sub-components
// =============================================================================

/** Connection status indicator */
function ConnectionIndicator({
  status,
  repo,
}: {
  status: ConnectionStatus;
  repo?: RepoInfo;
}) {
  if (status === "disconnected") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Unplug className="h-4 w-4" />
        <span>Not connected</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 text-red-500">
        <AlertCircle className="h-4 w-4" />
        <span>Connection error</span>
      </div>
    );
  }

  if (!repo) return null;

  return (
    <div className="flex items-center gap-2">
      <Github className="h-4 w-4" />
      <a
        href={repo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium hover:underline"
      >
        {repo.owner}/{repo.name}
      </a>
      {repo.isPrivate && (
        <Badge variant="secondary" className="text-xs">
          Private
        </Badge>
      )}
    </div>
  );
}

/** Branch display */
function BranchInfo({ repo }: { repo: RepoInfo }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <GitBranch className="h-3.5 w-3.5" />
      <span>{repo.currentBranch}</span>
      {repo.currentBranch !== repo.defaultBranch && (
        <span className="text-xs">
          (default: {repo.defaultBranch})
        </span>
      )}
    </div>
  );
}

/** Sync status display */
function SyncStatusDisplay({ syncState }: { syncState: SyncState }) {
  const { status, lastSyncTime, pendingChanges, ahead, behind, error } = syncState;

  return (
    <div className="space-y-2">
      {/* Status line */}
      <div className="flex items-center gap-2">
        {status === "syncing" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-500">Syncing...</span>
          </>
        )}
        {status === "success" && (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500">Synced</span>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-500">Sync failed</span>
          </>
        )}
        {status === "idle" && lastSyncTime && (
          <>
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Last sync: {formatRelativeTime(lastSyncTime)}
            </span>
          </>
        )}
        {status === "idle" && !lastSyncTime && (
          <span className="text-sm text-muted-foreground">Never synced</span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Change indicators */}
      <div className="flex items-center gap-3 text-xs">
        {pendingChanges > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  {pendingChanges} pending
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {pendingChanges} uncommitted {pendingChanges === 1 ? "change" : "changes"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {ahead > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-green-600">
                  <span>↑</span>
                  {ahead}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {ahead} {ahead === 1 ? "commit" : "commits"} ahead of remote
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {behind > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-orange-600">
                  <span>↓</span>
                  {behind}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {behind} {behind === 1 ? "commit" : "commits"} behind remote
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * GitHubPanel provides repository connection and sync management.
 *
 * @example
 * ```tsx
 * <GitHubPanel
 *   connectionStatus="connected"
 *   repo={{
 *     owner: "user",
 *     name: "my-theme",
 *     url: "https://github.com/user/my-theme",
 *     defaultBranch: "main",
 *     currentBranch: "main",
 *     isPrivate: false,
 *   }}
 *   syncState={{
 *     status: "idle",
 *     lastSyncTime: new Date(),
 *     pendingChanges: 0,
 *     ahead: 0,
 *     behind: 0,
 *   }}
 *   onSync={handleSync}
 * />
 * ```
 */
export function GitHubPanel({
  connectionStatus,
  repo,
  syncState,
  onConnect,
  onDisconnect,
  onSync,
  onPull,
  onPush,
  className = "",
}: GitHubPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (!onSync || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  }, [onSync, isSyncing]);

  const handlePull = useCallback(async () => {
    if (!onPull || isSyncing) return;
    setIsSyncing(true);
    try {
      await onPull();
    } finally {
      setIsSyncing(false);
    }
  }, [onPull, isSyncing]);

  const handlePush = useCallback(async () => {
    if (!onPush || isSyncing) return;
    setIsSyncing(true);
    try {
      await onPush();
    } finally {
      setIsSyncing(false);
    }
  }, [onPush, isSyncing]);

  const isConnected = connectionStatus === "connected" && repo;
  const canSync = isConnected && !isSyncing && syncState.status !== "syncing";

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">GitHub</CardTitle>
          {isConnected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
            >
              <Unplug className="mr-1 h-3 w-3" />
              Disconnect
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onConnect}
              className="h-7 text-xs"
            >
              <LinkIcon className="mr-1 h-3 w-3" />
              Connect
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">
          {isConnected
            ? "Repository connected and syncing"
            : "Connect a GitHub repository to sync your theme"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection status */}
        <ConnectionIndicator status={connectionStatus} repo={repo} />

        {/* Branch info */}
        {isConnected && <BranchInfo repo={repo} />}

        {/* Sync status */}
        {isConnected && <SyncStatusDisplay syncState={syncState} />}

        {/* Sync controls */}
        {isConnected && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleSync}
              disabled={!canSync}
              className="flex-1"
            >
              {isSyncing || syncState.status === "syncing" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync
            </Button>

            {onPull && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePull}
                      disabled={!canSync || syncState.behind === 0}
                    >
                      <span className="text-sm">↓</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Pull from remote</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {onPush && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePush}
                      disabled={!canSync || syncState.ahead === 0}
                    >
                      <span className="text-sm">↑</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Push to remote</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}

        {/* Not connected state */}
        {!isConnected && (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <Github className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Connect to GitHub to enable version control and collaboration
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onConnect}
              className="mt-3"
            >
              <Github className="mr-2 h-4 w-4" />
              Connect Repository
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GitHubPanel;
