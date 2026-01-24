"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSyncStore, useProjectStore } from "@/lib/stores";
import { getSyncManager, disconnectSyncManager, type SyncManager } from "@/lib/sync";

/**
 * Hook for managing sync connection to platxa-editor-sync
 */
export function useSync() {
  const managerRef = useRef<SyncManager | null>(null);
  const { sidecarUrl, authToken, status, connect, disconnect, setStatus } = useSyncStore();
  const { setFiles } = useProjectStore();

  // Initialize connection
  const initConnection = useCallback(
    async (url: string, token: string) => {
      connect(url, token);

      const manager = getSyncManager(url, token);
      if (manager) {
        managerRef.current = manager;

        // Load initial files
        try {
          const files = await manager.listFiles();
          if (files.length > 0) {
            // Convert sidecar file format to our FileNode format
            const fileNodes = convertToFileNodes(files);
            setFiles(fileNodes);
          }
          setStatus("connected");
        } catch (error) {
          console.error("Failed to load files:", error);
          setStatus("error", "Failed to load files");
        }
      }
    },
    [connect, setFiles, setStatus]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSyncManager();
    };
  }, []);

  // Write file
  const writeFile = useCallback(
    async (path: string, content: string) => {
      if (!managerRef.current) {
        throw new Error("Not connected");
      }
      return managerRef.current.writeFile(path, content);
    },
    []
  );

  // Write multiple files
  const writeFiles = useCallback(
    async (files: Array<{ path: string; content: string }>) => {
      if (!managerRef.current) {
        throw new Error("Not connected");
      }
      return managerRef.current.writeFiles(files);
    },
    []
  );

  // Deploy changes
  const deploy = useCallback(async (moduleName: string) => {
    if (!managerRef.current) {
      throw new Error("Not connected");
    }
    return managerRef.current.deploy(moduleName);
  }, []);

  // Export as ZIP
  const exportZip = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error("Not connected");
    }
    return managerRef.current.exportZip();
  }, []);

  // Disconnect
  const disconnectFromSidecar = useCallback(() => {
    disconnectSyncManager();
    disconnect();
    managerRef.current = null;
  }, [disconnect]);

  return {
    status,
    isConnected: status === "connected",
    connect: initConnection,
    disconnect: disconnectFromSidecar,
    writeFile,
    writeFiles,
    deploy,
    exportZip,
  };
}

/**
 * Convert sidecar file list to FileNode format
 */
function convertToFileNodes(files: any[]): any[] {
  // Group files by directory
  const root: any[] = [];
  const dirs: Map<string, any> = new Map();

  for (const file of files) {
    const parts = file.path.split("/");
    let currentPath = "";
    let currentArray = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        // It's a file
        currentArray.push({
          id: file.path,
          name: part,
          path: file.path,
          type: "file",
          content: "",
        });
      } else {
        // It's a directory
        if (!dirs.has(currentPath)) {
          const dir = {
            id: currentPath,
            name: part,
            path: currentPath,
            type: "directory",
            children: [],
          };
          currentArray.push(dir);
          dirs.set(currentPath, dir);
        }
        currentArray = dirs.get(currentPath)!.children;
      }
    }
  }

  return root;
}
