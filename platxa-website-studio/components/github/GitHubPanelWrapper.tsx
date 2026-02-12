"use client";

/**
 * GitHubPanelWrapper - Connects GitHubPanel to useGitHubSync hook and project store
 */

import { useCallback } from "react";
import { GitHubPanel } from "./GitHubPanel";
import { useGitHubSync } from "@/lib/hooks/use-github-sync";
import { useProjectStore, useEditorStore } from "@/lib/stores";

interface GitHubPanelWrapperProps {
  projectId: string;
}

export function GitHubPanelWrapper({ projectId }: GitHubPanelWrapperProps) {
  const github = useGitHubSync();
  const repo = github.getRepoForProject(projectId);
  const { setFiles } = useProjectStore();
  const openGeneratedFiles = useEditorStore((s) => s.openGeneratedFiles);

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
    const result = await github.sync(projectId);
    if (result?.pulled && result.pulled.length > 0) {
      // Fetch updated files from the API and apply to stores
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const { project } = await res.json();
          if (project.files?.length > 0) {
            const fileNodes = project.files.map((f: { path: string; name: string; content: string }) => ({
              id: f.path,
              name: f.name || f.path.split("/").pop() || f.path,
              path: f.path,
              type: "file" as const,
              content: f.content,
            }));
            setFiles(fileNodes);
            openGeneratedFiles(
              project.files.map((f: { path: string; content: string; language: string }) => ({
                path: f.path,
                content: f.content,
                language: f.language || "xml",
              }))
            );
          }
        }
      } catch (err) {
        console.error("[GitHub] Failed to apply synced files:", err);
      }
    }
  }, [github, projectId, setFiles, openGeneratedFiles]);

  const handlePull = useCallback(async () => {
    const result = await github.pull(projectId);
    if (result?.pulled && result.pulled.length > 0) {
      // Fetch updated files from the API and apply to stores
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const { project } = await res.json();
          if (project.files?.length > 0) {
            const fileNodes = project.files.map((f: { path: string; name: string; content: string }) => ({
              id: f.path,
              name: f.name || f.path.split("/").pop() || f.path,
              path: f.path,
              type: "file" as const,
              content: f.content,
            }));
            setFiles(fileNodes);
            openGeneratedFiles(
              project.files.map((f: { path: string; content: string; language: string }) => ({
                path: f.path,
                content: f.content,
                language: f.language || "xml",
              }))
            );
          }
        }
      } catch (err) {
        console.error("[GitHub] Failed to apply pulled files:", err);
      }
    }
  }, [github, projectId, setFiles, openGeneratedFiles]);

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
