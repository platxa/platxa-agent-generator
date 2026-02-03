/**
 * useCollaboration Hook
 *
 * React hook for real-time collaboration features.
 * Provides access to collaborator presence and document sync.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CollaborationProvider,
  createCollaborationProvider,
  type CollaboratorInfo,
  type CollaborationState,
  type CollaborationConfig,
  type CollaborationEvent,
} from "@/lib/collaboration";

// =============================================================================
// Types
// =============================================================================

export interface UseCollaborationOptions {
  /** WebSocket server URL */
  serverUrl?: string;
  /** Room/document identifier */
  roomId: string;
  /** User display name */
  userName: string;
  /** User avatar URL */
  userAvatar?: string;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Enable collaboration features */
  enabled?: boolean;
}

export interface UseCollaborationReturn {
  /** Whether connected to collaboration server */
  connected: boolean;
  /** Whether currently connecting */
  connecting: boolean;
  /** Connection error message */
  error: string | null;
  /** All connected collaborators */
  collaborators: CollaboratorInfo[];
  /** Remote collaborators (excluding local user) */
  remoteCollaborators: CollaboratorInfo[];
  /** Local user info */
  localUser: CollaboratorInfo | null;
  /** Connect to collaboration server */
  connect: () => Promise<void>;
  /** Disconnect from collaboration server */
  disconnect: () => void;
  /** Update local cursor position */
  setCursor: (filePath: string, line: number, column: number) => void;
  /** Update local selection */
  setSelection: (
    filePath: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ) => void;
  /** Notify typing activity */
  setTyping: () => void;
  /** Get collaborators in a specific file */
  getCollaboratorsInFile: (filePath: string) => CollaboratorInfo[];
  /** The underlying provider (for advanced use) */
  provider: CollaborationProvider | null;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_SERVER_URL = process.env.NEXT_PUBLIC_COLLAB_SERVER_URL || "ws://localhost:1234";

// =============================================================================
// Hook Implementation
// =============================================================================

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationReturn {
  const {
    serverUrl = DEFAULT_SERVER_URL,
    roomId,
    userName,
    userAvatar,
    autoConnect = true,
    enabled = true,
  } = options;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [localUser, setLocalUser] = useState<CollaboratorInfo | null>(null);

  const providerRef = useRef<CollaborationProvider | null>(null);

  // Initialize provider
  useEffect(() => {
    if (!enabled) return;

    const config: CollaborationConfig = {
      serverUrl,
      roomId,
      userName,
      userAvatar,
      isAi: false,
    };

    providerRef.current = createCollaborationProvider(config);

    // Subscribe to events
    const unsubscribe = providerRef.current.on((event: CollaborationEvent) => {
      switch (event.type) {
        case "connected":
          setConnected(true);
          setConnecting(false);
          setError(null);
          break;

        case "disconnected":
          setConnected(false);
          setConnecting(false);
          break;

        case "awareness:change":
          if (Array.isArray(event.data)) {
            setCollaborators(event.data as CollaboratorInfo[]);
            const local = (event.data as CollaboratorInfo[]).find((c) => c.isLocal);
            if (local) setLocalUser(local);
          }
          break;

        case "error":
          setError(event.data instanceof Error ? event.data.message : String(event.data));
          setConnecting(false);
          break;
      }
    });

    // Auto-connect if enabled
    if (autoConnect) {
      setConnecting(true);
      providerRef.current.connect().catch((err) => {
        setError(err instanceof Error ? err.message : "Connection failed");
        setConnecting(false);
      });
    }

    return () => {
      unsubscribe();
      providerRef.current?.destroy();
      providerRef.current = null;
    };
  }, [enabled, serverUrl, roomId, userName, userAvatar, autoConnect]);

  // Connect function
  const connect = useCallback(async () => {
    if (!providerRef.current || connected || connecting) return;

    setConnecting(true);
    setError(null);

    try {
      await providerRef.current.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      throw err;
    }
  }, [connected, connecting]);

  // Disconnect function
  const disconnect = useCallback(() => {
    providerRef.current?.disconnect();
  }, []);

  // Cursor functions
  const setCursor = useCallback((filePath: string, line: number, column: number) => {
    providerRef.current?.setCursor(filePath, line, column);
  }, []);

  const setSelection = useCallback(
    (
      filePath: string,
      startLine: number,
      startColumn: number,
      endLine: number,
      endColumn: number
    ) => {
      providerRef.current?.setSelection(filePath, startLine, startColumn, endLine, endColumn);
    },
    []
  );

  const setTyping = useCallback(() => {
    providerRef.current?.setTyping();
  }, []);

  // Get collaborators in file
  const getCollaboratorsInFile = useCallback(
    (filePath: string): CollaboratorInfo[] => {
      return collaborators.filter((c) => c.currentFile === filePath && !c.isLocal);
    },
    [collaborators]
  );

  // Remote collaborators (excluding local user)
  const remoteCollaborators = collaborators.filter((c) => !c.isLocal);

  return {
    connected,
    connecting,
    error,
    collaborators,
    remoteCollaborators,
    localUser,
    connect,
    disconnect,
    setCursor,
    setSelection,
    setTyping,
    getCollaboratorsInFile,
    provider: providerRef.current,
  };
}

// =============================================================================
// Collaboration Context (Optional)
// =============================================================================

import { createContext, useContext, type ReactNode } from "react";

const CollaborationContext = createContext<UseCollaborationReturn | null>(null);

export interface CollaborationProviderProps {
  children: ReactNode;
  options: UseCollaborationOptions;
}

export function CollaborationContextProvider({ children, options }: CollaborationProviderProps) {
  const collaboration = useCollaboration(options);

  return (
    <CollaborationContext.Provider value={collaboration}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaborationContext(): UseCollaborationReturn {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error("useCollaborationContext must be used within CollaborationContextProvider");
  }
  return context;
}
