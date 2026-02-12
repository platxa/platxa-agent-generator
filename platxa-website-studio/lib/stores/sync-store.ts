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
 * Sync state interface
 */
interface SyncState {
  // Connection
  status: SyncStatus;
  sidecarUrl: string | null;
  authToken: string | null;

  // Deploy events
  isDeploying: boolean;

  // Preview
  previewUrl: string | null;
  previewStatus: "loading" | "ready" | "error";

  // Actions
  connect: (sidecarUrl: string, authToken: string) => void;
  disconnect: () => void;
  setStatus: (status: SyncStatus, error?: string) => void;
  addDeployEvent: (event: Omit<DeployEvent, "timestamp">) => void;
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
  isDeploying: false,
  previewUrl: null,
  previewStatus: "loading",

  // Actions
  connect: (sidecarUrl, authToken) =>
    set({
      sidecarUrl,
      authToken,
      status: "connecting",
    }),

  disconnect: () =>
    set({
      status: "disconnected",
      sidecarUrl: null,
      authToken: null,
    }),

  setStatus: (status, error) =>
    set({
      status,
    }),

  addDeployEvent: (event) =>
    set((state) => {
      const newEvent: DeployEvent = {
        ...event,
        timestamp: new Date(),
      };

      // Update deploying state based on event type
      let isDeploying = state.isDeploying;

      if (event.type === "deploy_started") {
        isDeploying = true;
      } else if (
        event.type === "deploy_complete" ||
        event.type === "deploy_error"
      ) {
        isDeploying = false;
      }

      return {
        isDeploying,
      };
    }),

  setPreviewStatus: (status) => set({ previewStatus: status }),

  reset: () =>
    set({
      status: "disconnected",
      sidecarUrl: null,
      authToken: null,
      isDeploying: false,
      previewUrl: null,
      previewStatus: "loading",
    }),
}));
