/**
 * Yjs Provider Template Generator
 *
 * Generates a React context provider for Yjs WebSocket connection management.
 */

/**
 * Options for YjsProvider template generation.
 */
export interface YjsProviderTemplateOptions {
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Whether to include reconnection logic */
  includeReconnection: boolean;
  /** Whether to include IndexedDB persistence */
  includeIndexedDb: boolean;
  /** Default WebSocket URL */
  defaultWsUrl: string;
}

/**
 * Default options for YjsProvider template.
 */
const DEFAULT_OPTIONS: YjsProviderTemplateOptions = {
  useTypeScript: true,
  includeReconnection: true,
  includeIndexedDb: false,
  defaultWsUrl: 'ws://localhost:1234',
};

/**
 * Generates the imports section for YjsProvider.
 *
 * @param options - Template options
 * @returns Import statements string
 */
function generateImports(options: YjsProviderTemplateOptions): string {
  const imports: string[] = [
    `'use client';`,
    ``,
    `import {`,
    `  createContext,`,
    `  useContext,`,
    `  useEffect,`,
    `  useState,`,
    `  useCallback,`,
    `  useMemo,`,
    `  useRef,`,
    `} from 'react';`,
    `import * as Y from 'yjs';`,
    `import { WebsocketProvider } from 'y-websocket';`,
  ];

  if (options.includeIndexedDb) {
    imports.push(`import { IndexeddbPersistence } from 'y-indexeddb';`);
  }

  if (options.useTypeScript) {
    imports.push(`import type { Awareness } from 'y-protocols/awareness';`);
    imports.push(`import type { ReactNode } from 'react';`);
  }

  return imports.join('\n');
}

/**
 * Generates the types and interfaces.
 *
 * @param options - Template options
 * @returns Types string
 */
function generateTypes(options: YjsProviderTemplateOptions): string {
  if (!options.useTypeScript) {
    return '';
  }

  return `
/**
 * Connection state for WebSocket provider.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * User presence information for awareness.
 */
export interface UserPresence {
  id: string;
  name: string;
  color: string;
  colorLight: string;
}

/**
 * Yjs context value.
 */
export interface YjsContextValue {
  /** The Y.Doc instance */
  doc: Y.Doc;
  /** The WebSocket provider */
  provider: WebsocketProvider | null;
  /** The awareness instance for cursor sync */
  awareness: Awareness | null;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Whether the provider is connected */
  isConnected: boolean;
  /** Connect to the WebSocket server */
  connect: () => void;
  /** Disconnect from the WebSocket server */
  disconnect: () => void;
  /** Set local user presence */
  setLocalPresence: (presence: Partial<UserPresence>) => void;
  /** Get all connected users */
  getConnectedUsers: () => UserPresence[];
}

/**
 * Props for YjsProvider component.
 */
export interface YjsProviderProps {
  /** WebSocket server URL */
  websocketUrl?: string;
  /** Room name for collaboration */
  roomName: string;
  /** Authentication token */
  token?: string;
  /** Local user information */
  user?: UserPresence;
  /** Children to render */
  children: ReactNode;
  /** Called when connection state changes */
  onConnectionChange?: (state: ConnectionState) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}
`;
}

/**
 * Generates the provider implementation.
 *
 * @param options - Template options
 * @returns Provider implementation string
 */
function generateProvider(options: YjsProviderTemplateOptions): string {
  const propsType = options.useTypeScript ? ': YjsProviderProps' : '';
  const contextType = options.useTypeScript ? '<YjsContextValue | null>' : '';
  const stateType = options.useTypeScript ? ': ConnectionState' : '';

  let implementation = `
const YjsContext = createContext${contextType}(null);

/**
 * Generate a random color for user presence.
 */
function generateUserColor()${options.useTypeScript ? ': { color: string; colorLight: string }' : ''} {
  const hue = Math.floor(Math.random() * 360);
  return {
    color: \`hsl(\${hue}, 70%, 45%)\`,
    colorLight: \`hsl(\${hue}, 70%, 90%)\`,
  };
}

/**
 * Yjs Provider component for managing WebSocket connections and Y.Doc.
 */
export function YjsProvider({
  websocketUrl = '${options.defaultWsUrl}',
  roomName,
  token,
  user,
  children,
  onConnectionChange,
  onError,
}${propsType}) {
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState${options.useTypeScript ? '<WebsocketProvider | null>' : ''}(null);
  const [connectionState, setConnectionState] = useState${stateType}('disconnected');
  const providerRef = useRef${options.useTypeScript ? '<WebsocketProvider | null>' : ''}(null);
`;

  if (options.includeIndexedDb) {
    implementation += `  const [persistence, setPersistence] = useState${options.useTypeScript ? '<IndexeddbPersistence | null>' : ''}(null);
`;
  }

  implementation += `
  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (providerRef.current) {
      return; // Already connected
    }

    try {
      setConnectionState('connecting');

      const params${options.useTypeScript ? ': Record<string, string>' : ''} = {};
      if (token) {
        params.token = token;
      }

      const wsProvider = new WebsocketProvider(
        websocketUrl,
        roomName,
        doc,
        { params }
      );

      // Connection status handlers
      wsProvider.on('status', ({ status }${options.useTypeScript ? ': { status: string }' : ''}) => {
        const newState${stateType} = status === 'connected' ? 'connected' : 'connecting';
        setConnectionState(newState);
        onConnectionChange?.(newState);
      });

      wsProvider.on('connection-close', () => {
        setConnectionState('reconnecting');
        onConnectionChange?.('reconnecting');
      });

      wsProvider.on('connection-error', (error${options.useTypeScript ? ': Error' : ''}) => {
        onError?.(error);
      });

      // Set local user presence
      if (user) {
        const { color, colorLight } = generateUserColor();
        wsProvider.awareness.setLocalState({
          id: user.id,
          name: user.name,
          color: user.color || color,
          colorLight: user.colorLight || colorLight,
        });
      }

      providerRef.current = wsProvider;
      setProvider(wsProvider);
`;

  if (options.includeIndexedDb) {
    implementation += `
      // Set up IndexedDB persistence
      const indexedDb = new IndexeddbPersistence(roomName, doc);
      indexedDb.on('synced', () => {
        console.log('Content loaded from IndexedDB');
      });
      setPersistence(indexedDb);
`;
  }

  implementation += `
    } catch (error) {
      setConnectionState('disconnected');
      onError?.(error instanceof Error ? error : new Error('Connection failed'));
    }
  }, [websocketUrl, roomName, doc, token, user, onConnectionChange, onError]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
      setProvider(null);
      setConnectionState('disconnected');
      onConnectionChange?.('disconnected');
    }
`;

  if (options.includeIndexedDb) {
    implementation += `
    if (persistence) {
      persistence.destroy();
      setPersistence(null);
    }
`;
  }

  implementation += `  }, [onConnectionChange${options.includeIndexedDb ? ', persistence' : ''}]);

  // Set local user presence
  const setLocalPresence = useCallback((presence${options.useTypeScript ? ': Partial<UserPresence>' : ''}) => {
    if (provider?.awareness) {
      const currentState = provider.awareness.getLocalState() || {};
      provider.awareness.setLocalState({
        ...currentState,
        ...presence,
      });
    }
  }, [provider]);

  // Get all connected users
  const getConnectedUsers = useCallback(()${options.useTypeScript ? ': UserPresence[]' : ''} => {
    if (!provider?.awareness) {
      return [];
    }

    const users${options.useTypeScript ? ': UserPresence[]' : ''} = [];
    provider.awareness.getStates().forEach((state) => {
      if (state && typeof state === 'object' && 'id' in state) {
        users.push(state as UserPresence);
      }
    });
    return users;
  }, [provider]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const contextValue = useMemo(
    ()${options.useTypeScript ? ': YjsContextValue' : ''} => ({
      doc,
      provider,
      awareness: provider?.awareness || null,
      connectionState,
      isConnected: connectionState === 'connected',
      connect,
      disconnect,
      setLocalPresence,
      getConnectedUsers,
    }),
    [
      doc,
      provider,
      connectionState,
      connect,
      disconnect,
      setLocalPresence,
      getConnectedUsers,
    ]
  );

  return (
    <YjsContext.Provider value={contextValue}>
      {children}
    </YjsContext.Provider>
  );
}
`;

  return implementation;
}

/**
 * Generates the hook export.
 *
 * @param options - Template options
 * @returns Hook export string
 */
function generateHook(options: YjsProviderTemplateOptions): string {
  const returnType = options.useTypeScript ? ': YjsContextValue' : '';

  return `
/**
 * Hook to access Yjs context.
 *
 * @returns YjsContextValue
 * @throws Error if used outside YjsProvider
 */
export function useYjsProvider()${returnType} {
  const context = useContext(YjsContext);
  if (!context) {
    throw new Error('useYjsProvider must be used within a YjsProvider');
  }
  return context;
}

export default YjsProvider;
`;
}

/**
 * Generates a complete YjsProvider file.
 *
 * @param options - Template options (partial, merged with defaults)
 * @returns Complete provider file content
 */
export function generateYjsProviderTemplate(
  options: Partial<YjsProviderTemplateOptions> = {}
): string {
  const mergedOptions: YjsProviderTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const imports = generateImports(mergedOptions);
  const types = generateTypes(mergedOptions);
  const provider = generateProvider(mergedOptions);
  const hook = generateHook(mergedOptions);

  return `${imports}
${types}
${provider}
${hook}
`;
}
