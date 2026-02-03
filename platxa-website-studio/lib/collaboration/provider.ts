/**
 * Collaboration Provider
 *
 * Sets up WebSocket-based real-time collaboration using Yjs.
 * Manages document synchronization and user awareness.
 */

import { Y, Awareness, createYDoc, createAwareness, type YDoc, type YText, type AwarenessType } from "@/lib/yjs-singleton";
import { WebsocketProvider } from "y-websocket";

// =============================================================================
// Types
// =============================================================================

export interface CollaboratorInfo {
  /** Unique client ID from Yjs */
  clientId: number;
  /** Display name */
  name: string;
  /** Avatar URL or initials */
  avatar?: string;
  /** Cursor color */
  color: string;
  /** Whether this is the local user */
  isLocal: boolean;
  /** Whether this is an AI agent */
  isAi: boolean;
  /** Current file being edited */
  currentFile?: string;
  /** Cursor position (line, column) */
  cursor?: { line: number; column: number };
  /** Selection range */
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
  /** Last activity timestamp */
  lastActivity: number;
  /** Current editing status */
  status: "idle" | "viewing" | "editing" | "typing";
}

export interface CollaborationState {
  /** Whether connected to collaboration server */
  connected: boolean;
  /** Connection status message */
  statusMessage: string;
  /** All connected collaborators */
  collaborators: CollaboratorInfo[];
  /** Current room/document ID */
  roomId: string;
  /** Local user info */
  localUser: CollaboratorInfo | null;
}

export interface CollaborationConfig {
  /** WebSocket server URL */
  serverUrl: string;
  /** Room/document identifier */
  roomId: string;
  /** User display name */
  userName: string;
  /** User avatar URL */
  userAvatar?: string;
  /** User color (auto-assigned if not provided) */
  userColor?: string;
  /** Whether this is an AI agent */
  isAi?: boolean;
  /** Connection timeout in ms */
  connectTimeout?: number;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
}

export type CollaborationEventType =
  | "connected"
  | "disconnected"
  | "collaborator:join"
  | "collaborator:leave"
  | "collaborator:update"
  | "awareness:change"
  | "sync:complete"
  | "error";

export interface CollaborationEvent {
  type: CollaborationEventType;
  data?: unknown;
  timestamp: number;
}

export type CollaborationEventCallback = (event: CollaborationEvent) => void;

// =============================================================================
// Color Palette for Collaborators
// =============================================================================

const COLLABORATOR_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#f97316", // Orange
  "#6366f1", // Indigo
];

const AI_COLOR = "#9333ea"; // Purple for AI

function getCollaboratorColor(clientId: number, isAi: boolean): string {
  if (isAi) return AI_COLOR;
  return COLLABORATOR_COLORS[clientId % COLLABORATOR_COLORS.length];
}

// =============================================================================
// Collaboration Provider Class
// =============================================================================

export class CollaborationProvider {
  private doc: YDoc;
  private awareness: AwarenessType;
  private wsProvider: WebsocketProvider | null = null;
  private config: Required<CollaborationConfig>;
  private callbacks: CollaborationEventCallback[] = [];
  private _state: CollaborationState;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: CollaborationConfig) {
    this.config = {
      serverUrl: config.serverUrl,
      roomId: config.roomId,
      userName: config.userName,
      userAvatar: config.userAvatar || "",
      userColor: config.userColor || "",
      isAi: config.isAi || false,
      connectTimeout: config.connectTimeout || 10000,
      autoReconnect: config.autoReconnect ?? true,
    };

    // Create Yjs document and awareness
    this.doc = createYDoc();
    this.awareness = createAwareness(this.doc);

    // Initialize state
    this._state = {
      connected: false,
      statusMessage: "Initializing...",
      collaborators: [],
      roomId: this.config.roomId,
      localUser: null,
    };

    // Set up awareness change listener
    this.awareness.on("change", this.handleAwarenessChange.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Connects to the collaboration server.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.wsProvider) {
        resolve();
        return;
      }

      this._state.statusMessage = "Connecting...";

      try {
        this.wsProvider = new WebsocketProvider(
          this.config.serverUrl,
          this.config.roomId,
          this.doc,
          { awareness: this.awareness }
        );

        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, this.config.connectTimeout);

        this.wsProvider.on("status", (event: { status: string }) => {
          if (event.status === "connected") {
            clearTimeout(timeout);
            this._state.connected = true;
            this._state.statusMessage = "Connected";
            this.setLocalUserInfo();
            this.emit({ type: "connected", timestamp: Date.now() });
            resolve();
          } else if (event.status === "disconnected") {
            this._state.connected = false;
            this._state.statusMessage = "Disconnected";
            this.emit({ type: "disconnected", timestamp: Date.now() });
          }
        });

        this.wsProvider.on("sync", (isSynced: boolean) => {
          if (isSynced) {
            this.emit({ type: "sync:complete", timestamp: Date.now() });
          }
        });
      } catch (error) {
        this._state.statusMessage = "Connection failed";
        this.emit({ type: "error", data: error, timestamp: Date.now() });
        reject(error);
      }
    });
  }

  /**
   * Disconnects from the collaboration server.
   */
  disconnect(): void {
    if (this.wsProvider) {
      this.wsProvider.disconnect();
      this.wsProvider.destroy();
      this.wsProvider = null;
    }
    this._state.connected = false;
    this._state.statusMessage = "Disconnected";
    this._state.collaborators = [];
    this.emit({ type: "disconnected", timestamp: Date.now() });
  }

  /**
   * Checks if connected.
   */
  isConnected(): boolean {
    return this._state.connected;
  }

  // ---------------------------------------------------------------------------
  // Awareness / Presence
  // ---------------------------------------------------------------------------

  /**
   * Sets the local user's awareness info.
   */
  private setLocalUserInfo(): void {
    const clientId = this.awareness.clientID;
    const color = this.config.userColor || getCollaboratorColor(clientId, this.config.isAi);

    const userInfo: CollaboratorInfo = {
      clientId,
      name: this.config.userName,
      avatar: this.config.userAvatar,
      color,
      isLocal: true,
      isAi: this.config.isAi,
      lastActivity: Date.now(),
      status: "idle",
    };

    this.awareness.setLocalState({
      user: userInfo,
      cursor: null,
      selection: null,
    });

    this._state.localUser = userInfo;
  }

  /**
   * Updates local user's cursor position.
   */
  setCursor(filePath: string, line: number, column: number): void {
    const currentState = this.awareness.getLocalState() as { user: CollaboratorInfo } | null;
    if (!currentState) return;

    this.awareness.setLocalState({
      ...currentState,
      user: {
        ...currentState.user,
        currentFile: filePath,
        cursor: { line, column },
        lastActivity: Date.now(),
        status: "editing",
      },
      cursor: { filePath, line, column },
    });

    this.scheduleIdleStatus();
  }

  /**
   * Updates local user's selection.
   */
  setSelection(
    filePath: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ): void {
    const currentState = this.awareness.getLocalState() as { user: CollaboratorInfo } | null;
    if (!currentState) return;

    this.awareness.setLocalState({
      ...currentState,
      user: {
        ...currentState.user,
        currentFile: filePath,
        selection: {
          start: { line: startLine, column: startColumn },
          end: { line: endLine, column: endColumn },
        },
        lastActivity: Date.now(),
        status: "editing",
      },
      selection: {
        filePath,
        start: { line: startLine, column: startColumn },
        end: { line: endLine, column: endColumn },
      },
    });

    this.scheduleIdleStatus();
  }

  /**
   * Sets typing status.
   */
  setTyping(): void {
    const currentState = this.awareness.getLocalState() as { user: CollaboratorInfo } | null;
    if (!currentState) return;

    this.awareness.setLocalState({
      ...currentState,
      user: {
        ...currentState.user,
        lastActivity: Date.now(),
        status: "typing",
      },
    });

    this.scheduleIdleStatus();
  }

  /**
   * Sets idle status after inactivity.
   */
  private scheduleIdleStatus(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.typingTimeout = setTimeout(() => {
      const currentState = this.awareness.getLocalState() as { user: CollaboratorInfo } | null;
      if (currentState && currentState.user.status !== "idle") {
        this.awareness.setLocalState({
          ...currentState,
          user: {
            ...currentState.user,
            status: "viewing",
          },
        });
      }
    }, 3000);
  }

  /**
   * Handles awareness state changes.
   */
  private handleAwarenessChange(changes: {
    added: number[];
    updated: number[];
    removed: number[];
  }): void {
    const states = this.awareness.getStates();
    const collaborators: CollaboratorInfo[] = [];

    for (const [clientId, state] of states) {
      if (state && typeof state === "object" && "user" in state) {
        const userState = state as { user: CollaboratorInfo };
        collaborators.push({
          ...userState.user,
          clientId,
          isLocal: clientId === this.awareness.clientID,
        });
      }
    }

    this._state.collaborators = collaborators;

    // Emit specific events
    for (const id of changes.added) {
      const collab = collaborators.find((c) => c.clientId === id);
      if (collab && !collab.isLocal) {
        this.emit({ type: "collaborator:join", data: collab, timestamp: Date.now() });
      }
    }

    for (const id of changes.removed) {
      this.emit({ type: "collaborator:leave", data: { clientId: id }, timestamp: Date.now() });
    }

    for (const id of changes.updated) {
      const collab = collaborators.find((c) => c.clientId === id);
      if (collab) {
        this.emit({ type: "collaborator:update", data: collab, timestamp: Date.now() });
      }
    }

    this.emit({ type: "awareness:change", data: collaborators, timestamp: Date.now() });
  }

  // ---------------------------------------------------------------------------
  // Document Access
  // ---------------------------------------------------------------------------

  /**
   * Gets the Yjs document.
   */
  getDoc(): YDoc {
    return this.doc;
  }

  /**
   * Gets the awareness instance.
   */
  getAwareness(): AwarenessType {
    return this.awareness;
  }

  /**
   * Gets a Y.Text for a specific file.
   */
  getText(filePath: string): YText {
    return this.doc.getText(filePath);
  }

  /**
   * Gets current collaboration state.
   */
  getState(): CollaborationState {
    return { ...this._state };
  }

  /**
   * Gets all collaborators except local user.
   */
  getRemoteCollaborators(): CollaboratorInfo[] {
    return this._state.collaborators.filter((c) => !c.isLocal);
  }

  /**
   * Gets collaborators in a specific file.
   */
  getCollaboratorsInFile(filePath: string): CollaboratorInfo[] {
    return this._state.collaborators.filter((c) => c.currentFile === filePath);
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /**
   * Subscribes to collaboration events.
   */
  on(callback: CollaborationEventCallback): () => void {
    this.callbacks.push(callback);
    return () => this.off(callback);
  }

  /**
   * Unsubscribes from collaboration events.
   */
  off(callback: CollaborationEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Emits an event to all subscribers.
   */
  private emit(event: CollaborationEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error("Collaboration event callback error:", error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Destroys the provider and cleans up resources.
   */
  destroy(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.disconnect();
    this.awareness.destroy();
    this.doc.destroy();
    this.callbacks = [];
  }
}

// =============================================================================
// Factory & Singleton
// =============================================================================

let globalProvider: CollaborationProvider | null = null;

/**
 * Creates a new collaboration provider.
 */
export function createCollaborationProvider(config: CollaborationConfig): CollaborationProvider {
  return new CollaborationProvider(config);
}

/**
 * Gets or creates the global collaboration provider.
 */
export function getCollaborationProvider(config?: CollaborationConfig): CollaborationProvider {
  if (!globalProvider && config) {
    globalProvider = createCollaborationProvider(config);
  }
  if (!globalProvider) {
    throw new Error("Collaboration provider not initialized. Call with config first.");
  }
  return globalProvider;
}

/**
 * Destroys the global collaboration provider.
 */
export function destroyCollaborationProvider(): void {
  if (globalProvider) {
    globalProvider.destroy();
    globalProvider = null;
  }
}
