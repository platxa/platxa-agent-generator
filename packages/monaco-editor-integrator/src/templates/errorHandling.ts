/**
 * Error Handling Template Generator
 *
 * Generates error handling components and utilities for Monaco + Yjs integration.
 */

/**
 * Options for error handling template generation.
 */
export interface ErrorHandlingTemplateOptions {
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Include retry logic */
  includeRetry: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  baseDelay: number;
}

/**
 * Default options for error handling template.
 */
const DEFAULT_OPTIONS: ErrorHandlingTemplateOptions = {
  useTypeScript: true,
  includeRetry: true,
  maxRetries: 5,
  baseDelay: 1000,
};

/**
 * Generates WebSocket error handler with retry logic.
 *
 * @param options - Template options
 * @returns WebSocket error handler file content
 */
export function generateWebSocketErrorHandler(
  options: Partial<ErrorHandlingTemplateOptions> = {}
): string {
  const mergedOptions: ErrorHandlingTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const typeAnnotations = mergedOptions.useTypeScript;

  let content = `/**
 * WebSocket Connection Error Handler
 *
 * Provides robust error handling with exponential backoff retry logic
 * for Yjs WebSocket connections.
 */

'use client';

import { useCallback, useRef, useState } from 'react';

`;

  if (typeAnnotations) {
    content += `/**
 * Connection error types.
 */
export type ConnectionErrorType =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

/**
 * Connection error with metadata.
 */
export interface ConnectionError {
  type: ConnectionErrorType;
  message: string;
  code?: number;
  retryable: boolean;
  timestamp: Date;
}

/**
 * Retry state information.
 */
export interface RetryState {
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
  isRetrying: boolean;
}

/**
 * Options for useConnectionRetry hook.
 */
export interface UseConnectionRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onError?: (error: ConnectionError) => void;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: () => void;
}

/**
 * Return type for useConnectionRetry hook.
 */
export interface UseConnectionRetryResult {
  error: ConnectionError | null;
  retryState: RetryState;
  handleError: (error: Error | Event) => void;
  retry: () => void;
  reset: () => void;
}

`;
  }

  content += `/**
 * Classify error into a ConnectionErrorType.
 */
function classifyError(error${typeAnnotations ? ': Error | Event' : ''})${typeAnnotations ? ': ConnectionErrorType' : ''} {
  if (error instanceof Event) {
    return 'NETWORK_ERROR';
  }

  const message = error.message.toLowerCase();

  if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
    return 'AUTH_ERROR';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT';
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return 'RATE_LIMITED';
  }
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'SERVER_ERROR';
  }
  if (message.includes('network') || message.includes('connection')) {
    return 'NETWORK_ERROR';
  }

  return 'UNKNOWN';
}

/**
 * Determine if an error type is retryable.
 */
function isRetryable(type${typeAnnotations ? ': ConnectionErrorType' : ''})${typeAnnotations ? ': boolean' : ''} {
  switch (type) {
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
    case 'SERVER_ERROR':
      return true;
    case 'AUTH_ERROR':
    case 'RATE_LIMITED':
    case 'UNKNOWN':
    default:
      return false;
  }
}

/**
 * Calculate delay with exponential backoff and jitter.
 */
function calculateDelay(
  attempt${typeAnnotations ? ': number' : ''},
  baseDelay${typeAnnotations ? ': number' : ''} = ${mergedOptions.baseDelay},
  maxDelay${typeAnnotations ? ': number' : ''} = 30000
)${typeAnnotations ? ': number' : ''} {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Hook for managing connection retries with exponential backoff.
 */
export function useConnectionRetry(
  connect${typeAnnotations ? ': () => void' : ''},
  options${typeAnnotations ? ': UseConnectionRetryOptions' : ''} = {}
)${typeAnnotations ? ': UseConnectionRetryResult' : ''} {
  const {
    maxRetries = ${mergedOptions.maxRetries},
    baseDelay = ${mergedOptions.baseDelay},
    maxDelay = 30000,
    onError,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [error, setError] = useState${typeAnnotations ? '<ConnectionError | null>' : ''}(null);
  const [retryState, setRetryState] = useState${typeAnnotations ? '<RetryState>' : ''}({
    attempt: 0,
    maxAttempts: maxRetries,
    nextRetryAt: null,
    isRetrying: false,
  });

  const timeoutRef = useRef${typeAnnotations ? '<ReturnType<typeof setTimeout> | null>' : ''}(null);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setError(null);
    setRetryState({
      attempt: 0,
      maxAttempts: maxRetries,
      nextRetryAt: null,
      isRetrying: false,
    });
  }, [maxRetries]);

  const handleError = useCallback((rawError${typeAnnotations ? ': Error | Event' : ''}) => {
    const errorType = classifyError(rawError);
    const connectionError${typeAnnotations ? ': ConnectionError' : ''} = {
      type: errorType,
      message: rawError instanceof Error ? rawError.message : 'Connection failed',
      retryable: isRetryable(errorType),
      timestamp: new Date(),
    };

    setError(connectionError);
    onError?.(connectionError);

    // Auto-retry if retryable and under max attempts
    if (connectionError.retryable && retryState.attempt < maxRetries) {
      const nextAttempt = retryState.attempt + 1;
      const delay = calculateDelay(nextAttempt, baseDelay, maxDelay);
      const nextRetryAt = new Date(Date.now() + delay);

      setRetryState({
        attempt: nextAttempt,
        maxAttempts: maxRetries,
        nextRetryAt,
        isRetrying: true,
      });

      onRetry?.(nextAttempt);

      timeoutRef.current = setTimeout(() => {
        setRetryState((prev) => ({ ...prev, isRetrying: false }));
        connect();
      }, delay);
    } else if (retryState.attempt >= maxRetries) {
      onMaxRetriesReached?.();
    }
  }, [retryState.attempt, maxRetries, baseDelay, maxDelay, connect, onError, onRetry, onMaxRetriesReached]);

  const retry = useCallback(() => {
    reset();
    connect();
  }, [reset, connect]);

  return {
    error,
    retryState,
    handleError,
    retry,
    reset,
  };
}

export default useConnectionRetry;
`;

  return content;
}

/**
 * Generates Monaco Editor error boundary component.
 *
 * @param options - Template options
 * @returns Error boundary component file content
 */
export function generateEditorErrorBoundary(
  options: Partial<ErrorHandlingTemplateOptions> = {}
): string {
  const mergedOptions: ErrorHandlingTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const typeAnnotations = mergedOptions.useTypeScript;

  let content = `/**
 * Monaco Editor Error Boundary
 *
 * Catches and handles errors in Monaco Editor components,
 * providing fallback UI and retry capabilities.
 */

'use client';

import { Component } from 'react';
`;

  if (typeAnnotations) {
    content += `import type { ReactNode, ErrorInfo } from 'react';

/**
 * Props for EditorErrorBoundary.
 */
export interface EditorErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
}

/**
 * State for EditorErrorBoundary.
 */
interface EditorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

`;
  }

  content += `/**
 * Error boundary component for Monaco Editor.
 *
 * Catches rendering errors and displays a fallback UI
 * with retry functionality.
 */
export class EditorErrorBoundary extends Component${typeAnnotations ? '<EditorErrorBoundaryProps, EditorErrorBoundaryState>' : ''} {
  constructor(props${typeAnnotations ? ': EditorErrorBoundaryProps' : ''}) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error${typeAnnotations ? ': Error' : ''})${typeAnnotations ? ': Partial<EditorErrorBoundaryState>' : ''} {
    return { hasError: true, error };
  }

  componentDidCatch(error${typeAnnotations ? ': Error' : ''}, errorInfo${typeAnnotations ? ': ErrorInfo' : ''}) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log error for debugging
    console.error('Monaco Editor Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: '24px',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            borderRadius: '8px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h3 style={{ color: '#f48771', marginBottom: '16px' }}>
            Editor Error
          </h3>
          <p style={{ marginBottom: '16px', color: '#9cdcfe' }}>
            {this.state.error?.message || 'An error occurred while loading the editor.'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0e639c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EditorErrorBoundary;
`;

  return content;
}

/**
 * Generates Yjs sync conflict resolution utilities.
 *
 * @param options - Template options
 * @returns Conflict resolution utilities file content
 */
export function generateConflictResolution(
  options: Partial<ErrorHandlingTemplateOptions> = {}
): string {
  const mergedOptions: ErrorHandlingTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const typeAnnotations = mergedOptions.useTypeScript;

  let content = `/**
 * Yjs Sync Conflict Resolution
 *
 * Utilities for handling CRDT merge conflicts in collaborative editing.
 * Note: Yjs CRDTs automatically resolve most conflicts, but these utilities
 * help with edge cases and provide user feedback.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
`;

  if (typeAnnotations) {
    content += `import type * as Y from 'yjs';

/**
 * Sync status information.
 */
export interface SyncStatus {
  /** Whether local changes are pending sync */
  hasPendingChanges: boolean;
  /** Number of pending operations */
  pendingOperations: number;
  /** Last sync timestamp */
  lastSyncAt: Date | null;
  /** Whether currently syncing */
  isSyncing: boolean;
}

/**
 * Options for useSyncStatus hook.
 */
export interface UseSyncStatusOptions {
  /** Y.Doc to monitor */
  doc: Y.Doc | null;
  /** Sync check interval in ms */
  checkInterval?: number;
}

`;
  }

  content += `/**
 * Hook to monitor Yjs document sync status.
 *
 * Tracks pending changes and sync state for user feedback.
 */
export function useSyncStatus(options${typeAnnotations ? ': UseSyncStatusOptions' : ''})${typeAnnotations ? ': SyncStatus' : ''} {
  const { doc, checkInterval = 1000 } = options;

  const [status, setStatus] = useState${typeAnnotations ? '<SyncStatus>' : ''}({
    hasPendingChanges: false,
    pendingOperations: 0,
    lastSyncAt: null,
    isSyncing: false,
  });

  useEffect(() => {
    if (!doc) {
      return;
    }

    let lastStateVector${typeAnnotations ? ': Uint8Array | null' : ''} = null;

    const checkSync = () => {
      const currentStateVector = Y.encodeStateVector(doc);

      if (lastStateVector) {
        // Compare state vectors to detect pending changes
        const hasChanges = !arraysEqual(currentStateVector, lastStateVector);

        setStatus((prev) => ({
          ...prev,
          hasPendingChanges: hasChanges,
          lastSyncAt: hasChanges ? prev.lastSyncAt : new Date(),
        }));
      }

      lastStateVector = currentStateVector;
    };

    // Initial check
    checkSync();

    // Periodic sync check
    const interval = setInterval(checkSync, checkInterval);

    // Listen for updates
    const handleUpdate = () => {
      setStatus((prev) => ({
        ...prev,
        hasPendingChanges: true,
        isSyncing: true,
      }));

      // Debounce sync completion
      setTimeout(() => {
        setStatus((prev) => ({
          ...prev,
          isSyncing: false,
          lastSyncAt: new Date(),
        }));
      }, 500);
    };

    doc.on('update', handleUpdate);

    return () => {
      clearInterval(interval);
      doc.off('update', handleUpdate);
    };
  }, [doc, checkInterval]);

  return status;
}

/**
 * Compare two Uint8Arrays for equality.
 */
function arraysEqual(a${typeAnnotations ? ': Uint8Array' : ''}, b${typeAnnotations ? ': Uint8Array' : ''})${typeAnnotations ? ': boolean' : ''} {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

// Y encoding import for state vector comparison
import * as Y from 'yjs';

export default useSyncStatus;
`;

  return content;
}
