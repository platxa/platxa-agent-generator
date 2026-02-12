/**
 * Preview Hot Reload Hook
 *
 * Watches for file changes in the editor and triggers preview updates
 * with debouncing and smooth transitions.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useEditorStore } from "@/lib/stores";

export interface HotReloadOptions {
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number;
  /** Whether hot reload is enabled (default: true) */
  enabled?: boolean;
  /** File patterns to watch (default: all) */
  watchPatterns?: RegExp[];
  /** Callback when reload is triggered */
  onReload?: (changedFiles: string[]) => void;
  /** Callback before reload starts */
  onBeforeReload?: () => void;
  /** Callback after reload completes */
  onAfterReload?: () => void;
}

export interface HotReloadState {
  /** Whether a reload is pending */
  isPending: boolean;
  /** Whether a reload is in progress */
  isReloading: boolean;
  /** Last reload timestamp */
  lastReload: number | null;
  /** Files that changed since last reload */
  changedFiles: string[];
  /** Total reload count */
  reloadCount: number;
}

export interface UsePreviewHotReloadReturn {
  /** Current hot reload state */
  state: HotReloadState;
  /** Manually trigger a reload */
  triggerReload: () => void;
  /** Enable/disable hot reload */
  setEnabled: (enabled: boolean) => void;
  /** Check if file matches watch patterns */
  isWatchedFile: (path: string) => boolean;
}

/**
 * Default file patterns to watch for preview updates
 */
const DEFAULT_WATCH_PATTERNS = [
  /\.xml$/i,      // QWeb templates
  /\.html$/i,     // HTML files
  /\.scss$/i,     // SCSS styles
  /\.css$/i,      // CSS styles
  /\.js$/i,       // JavaScript
  /\.py$/i,       // Python (manifest, models)
];

/**
 * Hook for automatic preview hot reload on file changes
 */
export function usePreviewHotReload(
  options: HotReloadOptions = {}
): UsePreviewHotReloadReturn {
  const {
    debounceMs = 300,
    enabled: initialEnabled = true,
    watchPatterns = DEFAULT_WATCH_PATTERNS,
    onReload,
    onBeforeReload,
    onAfterReload,
  } = options;

  const [enabled, setEnabled] = useState(initialEnabled);
  const [state, setState] = useState<HotReloadState>({
    isPending: false,
    isReloading: false,
    lastReload: null,
    changedFiles: [],
    reloadCount: 0,
  });

  // Refs for tracking
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousContentsRef = useRef<Record<string, string>>({});
  const changedFilesRef = useRef<Set<string>>(new Set());

  // Get file contents from editor store
  const fileContents = useEditorStore((state) => state.fileContents);

  /**
   * Check if a file path matches watch patterns
   */
  const isWatchedFile = useCallback(
    (path: string): boolean => {
      return watchPatterns.some((pattern) => pattern.test(path));
    },
    [watchPatterns]
  );

  /**
   * Execute the reload
   */
  const executeReload = useCallback(() => {
    const changedFiles = Array.from(changedFilesRef.current);

    if (changedFiles.length === 0) {
      setState((prev) => ({ ...prev, isPending: false }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isPending: false,
      isReloading: true,
    }));

    onBeforeReload?.();

    // Small delay to show loading state
    requestAnimationFrame(() => {
      onReload?.(changedFiles);

      setState((prev) => ({
        ...prev,
        isReloading: false,
        lastReload: Date.now(),
        changedFiles,
        reloadCount: prev.reloadCount + 1,
      }));

      changedFilesRef.current.clear();
      onAfterReload?.();
    });
  }, [onReload, onBeforeReload, onAfterReload]);

  /**
   * Manually trigger a reload
   */
  const triggerReload = useCallback(() => {
    // Mark all current files as changed
    Object.keys(fileContents).forEach((path) => {
      if (isWatchedFile(path)) {
        changedFilesRef.current.add(path);
      }
    });

    // Cancel any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    executeReload();
  }, [fileContents, isWatchedFile, executeReload]);

  /**
   * Watch for file changes
   */
  useEffect(() => {
    if (!enabled) return;

    // Check for changes
    const changes: string[] = [];

    for (const [path, content] of Object.entries(fileContents)) {
      if (!isWatchedFile(path)) continue;

      const previousContent = previousContentsRef.current[path];

      // New file or content changed
      if (previousContent === undefined || previousContent !== content) {
        changes.push(path);
        changedFilesRef.current.add(path);
      }
    }

    // Check for deleted files
    for (const path of Object.keys(previousContentsRef.current)) {
      if (!(path in fileContents) && isWatchedFile(path)) {
        changes.push(path);
        changedFilesRef.current.add(path);
      }
    }

    // Update previous contents
    previousContentsRef.current = { ...fileContents };

    // Schedule reload if there are changes
    if (changes.length > 0) {
      setState((prev) => ({ ...prev, isPending: true }));

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Schedule debounced reload
      debounceTimerRef.current = setTimeout(() => {
        executeReload();
        debounceTimerRef.current = null;
      }, debounceMs);
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fileContents, enabled, debounceMs, isWatchedFile, executeReload]);

  return {
    state,
    triggerReload,
    setEnabled,
    isWatchedFile,
  };
}

