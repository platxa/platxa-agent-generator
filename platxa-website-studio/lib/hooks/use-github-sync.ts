/**
 * useGitHubSync - React hook for GitHub synchronization
 *
 * Provides GitHub connection status, repository management,
 * and sync operations for components.
 */

import { useState, useEffect, useCallback } from 'react';

// Types
export interface GitHubConnection {
  id: string;
  githubLogin: string;
  githubEmail: string | null;
  githubAvatar: string | null;
  scope: string;
  obtainedAt: string;
}

export interface GitHubRepository {
  id: string;
  projectId: string;
  owner: string;
  repo: string;
  branch: string;
  fullName: string;
  isPrivate: boolean;
  lastSyncAt: string | null;
  lastCommitSha: string | null;
  syncStatus: 'IDLE' | 'SYNCING' | 'CONFLICT' | 'ERROR' | 'UP_TO_DATE';
}

export interface SyncResult {
  success: boolean;
  action: string;
  pushed: string[];
  pulled: string[];
  conflicts: Array<{
    path: string;
    localContent: string;
    remoteContent: string;
  }>;
  commitSha?: string;
  error?: string;
}

interface GitHubState {
  connected: boolean;
  connection: GitHubConnection | null;
  repositories: GitHubRepository[];
  loading: boolean;
  error: string | null;
}

interface UseGitHubSyncReturn extends GitHubState {
  // Connection
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;

  // Repository operations
  listRepos: () => Promise<Array<{ id: number; name: string; fullName: string; isPrivate: boolean }>>;
  linkRepo: (projectId: string, owner: string, repo: string, branch?: string) => Promise<boolean>;
  unlinkRepo: (projectId: string) => Promise<boolean>;

  // Sync operations
  push: (projectId: string, message?: string) => Promise<SyncResult | null>;
  pull: (projectId: string) => Promise<SyncResult | null>;
  sync: (projectId: string) => Promise<SyncResult | null>;

  // Helpers
  getRepoForProject: (projectId: string) => GitHubRepository | undefined;
  isSyncing: (projectId: string) => boolean;
}

/**
 * Hook for GitHub integration
 */
export function useGitHubSync(): UseGitHubSyncReturn {
  const [state, setState] = useState<GitHubState>({
    connected: false,
    connection: null,
    repositories: [],
    loading: true,
    error: null,
  });

  // Fetch current status
  const refresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/github');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch GitHub status');
      }

      setState({
        connected: data.connected,
        connection: data.connection,
        repositories: data.repositories || [],
        loading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Connect to GitHub (initiate OAuth)
  const connect = useCallback(async () => {
    try {
      const response = await fetch('/api/github/oauth');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate OAuth');
      }

      // Redirect to GitHub authorization
      window.location.href = data.authUrl;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, []);

  // Disconnect GitHub
  const disconnect = useCallback(async () => {
    try {
      const response = await fetch('/api/github', { method: 'DELETE' });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect');
      }

      setState({
        connected: false,
        connection: null,
        repositories: [],
        loading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      }));
    }
  }, []);

  // List available repositories
  const listRepos = useCallback(async () => {
    const response = await fetch('/api/github/repos');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch repositories');
    }

    return data.repositories;
  }, []);

  // Link repository to project
  const linkRepo = useCallback(async (
    projectId: string,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, owner, repo, branch }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link repository');
      }

      // Refresh to get updated repository list
      await refresh();
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Link failed',
      }));
      return false;
    }
  }, [refresh]);

  // Unlink repository from project
  const unlinkRepo = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/github/repos/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unlink repository');
      }

      // Refresh to get updated repository list
      await refresh();
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unlink failed',
      }));
      return false;
    }
  }, [refresh]);

  // Sync operation helper
  const performSync = useCallback(async (
    projectId: string,
    action: 'push' | 'pull' | 'sync',
    message?: string
  ): Promise<SyncResult | null> => {
    try {
      // Update local state to show syncing
      setState(prev => ({
        ...prev,
        repositories: prev.repositories.map(r =>
          r.projectId === projectId ? { ...r, syncStatus: 'SYNCING' as const } : r
        ),
      }));

      const response = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      // Refresh to get updated status
      await refresh();

      return data as SyncResult;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sync failed',
        repositories: prev.repositories.map(r =>
          r.projectId === projectId ? { ...r, syncStatus: 'ERROR' as const } : r
        ),
      }));
      return null;
    }
  }, [refresh]);

  const push = useCallback((projectId: string, message?: string) =>
    performSync(projectId, 'push', message), [performSync]);

  const pull = useCallback((projectId: string) =>
    performSync(projectId, 'pull'), [performSync]);

  const sync = useCallback((projectId: string) =>
    performSync(projectId, 'sync'), [performSync]);

  // Get repository for a project
  const getRepoForProject = useCallback((projectId: string) =>
    state.repositories.find(r => r.projectId === projectId), [state.repositories]);

  // Check if a project is currently syncing
  const isSyncing = useCallback((projectId: string) => {
    const repo = state.repositories.find(r => r.projectId === projectId);
    return repo?.syncStatus === 'SYNCING';
  }, [state.repositories]);

  return {
    ...state,
    connect,
    disconnect,
    refresh,
    listRepos,
    linkRepo,
    unlinkRepo,
    push,
    pull,
    sync,
    getRepoForProject,
    isSyncing,
  };
}

