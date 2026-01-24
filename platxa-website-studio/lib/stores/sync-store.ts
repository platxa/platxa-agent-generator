import { create } from "zustand";

/**
 * Sync connection status
 */
export type SyncStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "error";

/**
 * Deploy event types
 */
export type DeployEventType =
  | "deploy_started"
  | "deploy_progress"
  | "deploy_complete"
  | "deploy_error";

/**
 * Deploy event structure
 */
export interface DeployEvent {
  type: DeployEventType;
  timestamp: Date;
  message?: string;
  progress?: number;
  error?: string;
}

/**
 * File sync status
 */
export interface FileSyncStatus {
  path: string;
  status: "pending" | "syncing" | "synced" | "error";
  lastSynced?: Date;
  error?: string;
}

/**
 * Sync state interface
 */
interface SyncState {
  // Connection
  status: SyncStatus;
  sidecarUrl: string | null;
  authToken: string | null;
  connectionError: string | null;

  // File sync
  fileSyncStatus: Map<string, FileSyncStatus>;
  pendingWrites: string[];

  // Deploy events
  deployEvents: DeployEvent[];
  isDeploying: boolean;
  lastDeployTime: Date | null;

  // Preview
  previewUrl: string | null;
  previewStatus: "loading" | "ready" | "error";

  // Actions
  connect: (sidecarUrl: string, authToken: string) => void;
  disconnect: () => void;
  setStatus: (status: SyncStatus, error?: string) => void;
  setFileSyncStatus: (path: string, status: FileSyncStatus) => void;
  addPendingWrite: (path: string) => void;
  removePendingWrite: (path: string) => void;
  addDeployEvent: (event: Omit<DeployEvent, "timestamp">) => void;
  clearDeployEvents: () => void;
  setDeploying: (isDeploying: boolean) => void;
  setPreviewUrl: (url: string | null) => void;
  setPreviewStatus: (status: "loading" | "ready" | "error") => void;
  reset: () => void;
}

/**
 * Sync store - manages WebSocket connection and file sync state
 */
export const useSyncStore = create<SyncState>((set, get) => ({
  // Initial state
  status: "disconnected",
  sidecarUrl: null,
  authToken: null,
  connectionError: null,
  fileSyncStatus: new Map(),
  pendingWrites: [],
  deployEvents: [],
  isDeploying: false,
  lastDeployTime: null,
  previewUrl: null,
  previewStatus: "loading",

  // Actions
  connect: (sidecarUrl, authToken) =>
    set({
      sidecarUrl,
      authToken,
      status: "connecting",
      connectionError: null,
    }),

  disconnect: () =>
    set({
      status: "disconnected",
      sidecarUrl: null,
      authToken: null,
      connectionError: null,
      fileSyncStatus: new Map(),
      pendingWrites: [],
    }),

  setStatus: (status, error) =>
    set({
      status,
      connectionError: error || null,
    }),

  setFileSyncStatus: (path, status) =>
    set((state) => {
      const newStatus = new Map(state.fileSyncStatus);
      newStatus.set(path, status);
      return { fileSyncStatus: newStatus };
    }),

  addPendingWrite: (path) =>
    set((state) => ({
      pendingWrites: [...state.pendingWrites, path],
    })),

  removePendingWrite: (path) =>
    set((state) => ({
      pendingWrites: state.pendingWrites.filter((p) => p !== path),
    })),

  addDeployEvent: (event) =>
    set((state) => {
      const newEvent: DeployEvent = {
        ...event,
        timestamp: new Date(),
      };

      // Update deploying state based on event type
      let isDeploying = state.isDeploying;
      let lastDeployTime = state.lastDeployTime;

      if (event.type === "deploy_started") {
        isDeploying = true;
      } else if (
        event.type === "deploy_complete" ||
        event.type === "deploy_error"
      ) {
        isDeploying = false;
        lastDeployTime = new Date();
      }

      return {
        deployEvents: [...state.deployEvents.slice(-49), newEvent], // Keep last 50 events
        isDeploying,
        lastDeployTime,
      };
    }),

  clearDeployEvents: () => set({ deployEvents: [] }),

  setDeploying: (isDeploying) => set({ isDeploying }),

  setPreviewUrl: (url) => set({ previewUrl: url }),

  setPreviewStatus: (status) => set({ previewStatus: status }),

  reset: () =>
    set({
      status: "disconnected",
      sidecarUrl: null,
      authToken: null,
      connectionError: null,
      fileSyncStatus: new Map(),
      pendingWrites: [],
      deployEvents: [],
      isDeploying: false,
      lastDeployTime: null,
      previewUrl: null,
      previewStatus: "loading",
    }),
}));

/**
 * Selector for getting the last deploy event
 */
export const selectLastDeployEvent = (state: SyncState): DeployEvent | null => {
  return state.deployEvents[state.deployEvents.length - 1] || null;
};

/**
 * Selector for checking if all files are synced
 */
export const selectAllFilesSynced = (state: SyncState): boolean => {
  if (state.pendingWrites.length > 0) return false;

  for (const [, status] of state.fileSyncStatus) {
    if (status.status !== "synced") return false;
  }

  return true;
};

/**
 * Selector for getting files with sync errors
 */
export const selectFilesWithErrors = (state: SyncState): string[] => {
  const errorFiles: string[] = [];
  for (const [path, status] of state.fileSyncStatus) {
    if (status.status === "error") {
      errorFiles.push(path);
    }
  }
  return errorFiles;
};
