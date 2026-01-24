/**
 * WebSocket manager for connecting to platxa-editor-sync sidecar
 * Handles file sync and activity monitoring
 */

import { useSyncStore } from "@/lib/stores";

export interface FileWriteResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface DeployResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * SyncManager class for managing connection to platxa-editor-sync
 */
export class SyncManager {
  private sidecarUrl: string;
  private authToken: string;
  private activityWs: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(sidecarUrl: string, authToken: string) {
    this.sidecarUrl = sidecarUrl;
    this.authToken = authToken;
  }

  /**
   * Connect to the activity WebSocket for deploy events
   */
  connectActivity(): void {
    const wsUrl = `${this.sidecarUrl.replace("http", "ws")}/ws/activity`;

    this.activityWs = new WebSocket(wsUrl, [`bearer-${this.authToken}`]);

    this.activityWs.onopen = () => {
      console.log("[SyncManager] Activity WebSocket connected");
      this.reconnectAttempts = 0;
      useSyncStore.getState().setStatus("connected");
    };

    this.activityWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleActivityEvent(data);
      } catch (e) {
        console.error("[SyncManager] Failed to parse activity event:", e);
      }
    };

    this.activityWs.onclose = () => {
      console.log("[SyncManager] Activity WebSocket closed");
      useSyncStore.getState().setStatus("disconnected");
      this.attemptReconnect();
    };

    this.activityWs.onerror = (error) => {
      console.error("[SyncManager] Activity WebSocket error:", error);
      useSyncStore.getState().setStatus("error", "WebSocket connection failed");
    };
  }

  /**
   * Handle activity events from the sidecar
   */
  private handleActivityEvent(data: { type: string; [key: string]: any }): void {
    const store = useSyncStore.getState();

    switch (data.type) {
      case "deploy_started":
        store.addDeployEvent({
          type: "deploy_started",
          message: data.message || "Deployment started",
        });
        break;

      case "deploy_progress":
        store.addDeployEvent({
          type: "deploy_progress",
          message: data.message,
          progress: data.progress,
        });
        break;

      case "deploy_complete":
        store.addDeployEvent({
          type: "deploy_complete",
          message: data.message || "Deployment complete",
        });
        store.setPreviewStatus("loading"); // Trigger preview refresh
        break;

      case "deploy_error":
        store.addDeployEvent({
          type: "deploy_error",
          message: data.message,
          error: data.error,
        });
        break;

      default:
        console.log("[SyncManager] Unknown activity event:", data.type);
    }
  }

  /**
   * Attempt to reconnect the activity WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[SyncManager] Max reconnect attempts reached");
      useSyncStore.getState().setStatus("error", "Unable to reconnect");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[SyncManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connectActivity();
    }, delay);
  }

  /**
   * Write a file to the sidecar
   */
  async writeFile(path: string, content: string): Promise<FileWriteResult> {
    try {
      const response = await fetch(
        `${this.sidecarUrl}/files/${encodeURIComponent(path)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            "Content-Type": "application/octet-stream",
          },
          body: content,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, path, error };
      }

      return { success: true, path };
    } catch (error) {
      return {
        success: false,
        path,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Write multiple files to the sidecar
   */
  async writeFiles(
    files: Array<{ path: string; content: string }>
  ): Promise<FileWriteResult[]> {
    const results = await Promise.all(
      files.map((file) => this.writeFile(file.path, file.content))
    );
    return results;
  }

  /**
   * Read a file from the sidecar
   */
  async readFile(path: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.sidecarUrl}/files/${encodeURIComponent(path)}`,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      return await response.text();
    } catch (error) {
      console.error("[SyncManager] Failed to read file:", error);
      return null;
    }
  }

  /**
   * List files in the workspace
   */
  async listFiles(): Promise<any[]> {
    try {
      const response = await fetch(`${this.sidecarUrl}/files`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to list files");
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error("[SyncManager] Failed to list files:", error);
      return [];
    }
  }

  /**
   * Deploy changes (trigger Odoo module reload)
   */
  async deploy(moduleName: string): Promise<DeployResult> {
    try {
      const response = await fetch(
        `${this.sidecarUrl}/module/${encodeURIComponent(moduleName)}/deploy`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.authToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json();
      return { success: true, message: data.message };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Export workspace as ZIP
   */
  async exportZip(): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.sidecarUrl}/export`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to export");
      }

      return await response.blob();
    } catch (error) {
      console.error("[SyncManager] Failed to export:", error);
      return null;
    }
  }

  /**
   * Disconnect from sidecar
   */
  disconnect(): void {
    if (this.activityWs) {
      this.activityWs.close();
      this.activityWs = null;
    }
    useSyncStore.getState().setStatus("disconnected");
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

/**
 * Get or create the SyncManager instance
 */
export function getSyncManager(
  sidecarUrl?: string,
  authToken?: string
): SyncManager | null {
  if (sidecarUrl && authToken) {
    if (syncManagerInstance) {
      syncManagerInstance.disconnect();
    }
    syncManagerInstance = new SyncManager(sidecarUrl, authToken);
    syncManagerInstance.connectActivity();
    return syncManagerInstance;
  }
  return syncManagerInstance;
}

/**
 * Disconnect and clear the SyncManager instance
 */
export function disconnectSyncManager(): void {
  if (syncManagerInstance) {
    syncManagerInstance.disconnect();
    syncManagerInstance = null;
  }
}
