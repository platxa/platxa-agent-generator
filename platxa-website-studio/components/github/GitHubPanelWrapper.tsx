"use client";

/**
 * GitHubPanelWrapper - Connects GitHubPanel to useGitHubSync hook and project store
 */

import { useCallback } from "react";
import { GitHubPanel } from "./GitHubPanel";
import { useGitHubSync } from "@/lib/hooks/use-github-sync";
import { useProjectStore } from "@/lib/stores";

interface GitHubPanelWrapperProps {
  projectId: string;
}

export function GitHubPanelWrapper({ projectId }: GitHubPanelWrapperProps) {
  const github = useGitHubSync();
  const repo = github.getRepoForProject(projectId);

  const connectionStatus = github.connected
    ? repo ? "connected" : "disconnected"
    : "disconnected";

  const handleConnect = useCallback(async () => {
    await github.connect();
  }, [github]);

  const handleDisconnect = useCallback(async () => {
    await github.disconnect();
  }, [github]);

  const handleSync = useCallback(async () => {
    await github.sync(projectId);
  }, [github, projectId]);

  const handlePull = useCallback(async () => {
    await github.pull(projectId);
  }, [github, projectId]);

  const handlePush = useCallback(async () => {
    await github.push(projectId);
  }, [github, projectId]);

  return (
    <div className="h-full overflow-auto p-4">
      <GitHubPanel
        connectionStatus={connectionStatus as "connected" | "disconnected" | "error"}
        repo={repo ? {
          owner: repo.owner,
          name: repo.repo,
          url: `https://github.com/${repo.fullName}`,
          defaultBranch: repo.branch,
          currentBranch: repo.branch,
          isPrivate: repo.isPrivate,
        } : undefined}
        syncState={{
          status: repo?.syncStatus === "SYNCING" ? "syncing"
            : repo?.syncStatus === "ERROR" ? "error"
            : "idle",
          lastSyncTime: repo?.lastSyncAt ? new Date(repo.lastSyncAt) : null,
          pendingChanges: useProjectStore.getState().pendingChanges.length,
          ahead: 0,
          behind: 0,
        }}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSync={handleSync}
        onPull={handlePull}
        onPush={handlePush}
      />
    </div>
  );
}
