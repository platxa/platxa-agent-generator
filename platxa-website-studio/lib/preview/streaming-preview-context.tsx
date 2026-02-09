"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { IncrementalQWebParser, extractCssFromScss } from "./incremental-qweb-parser";

/**
 * Streaming preview state
 */
export interface StreamingPreviewState {
  isStreaming: boolean;
  partialHtml: string;
  partialCss: string;
  parseError: string | null;
  lastUpdateTime: number;
  completedTemplates: number;
  streamProgress: number; // 0-100
}

/**
 * Streaming preview context value
 */
export interface StreamingPreviewContextValue extends StreamingPreviewState {
  startStreaming: () => void;
  updateContent: (chunk: string) => void;
  endStreaming: () => void;
  resetPreview: () => void;
  getLatestHtml: () => string;
  getLatestCss: () => string;
}

const initialState: StreamingPreviewState = {
  isStreaming: false,
  partialHtml: "",
  partialCss: "",
  parseError: null,
  lastUpdateTime: 0,
  completedTemplates: 0,
  streamProgress: 0,
};

const StreamingPreviewContext = createContext<StreamingPreviewContextValue | null>(null);

/**
 * Custom hook to access streaming preview context
 */
export function useStreamingPreview(): StreamingPreviewContextValue {
  const context = useContext(StreamingPreviewContext);
  if (!context) {
    throw new Error("useStreamingPreview must be used within StreamingPreviewProvider");
  }
  return context;
}

/**
 * Safe version that returns null if not in provider
 */
export function useStreamingPreviewSafe(): StreamingPreviewContextValue | null {
  return useContext(StreamingPreviewContext);
}

/**
 * Provider props
 */
interface StreamingPreviewProviderProps {
  children: ReactNode;
  debounceMs?: number;
}

/**
 * Streaming Preview Provider
 *
 * Provides real-time preview updates during AI code generation.
 * Uses incremental parsing to show preview as soon as content is available.
 */
export function StreamingPreviewProvider({
  children,
  debounceMs = 100,
}: StreamingPreviewProviderProps) {
  const [state, setState] = useState<StreamingPreviewState>(initialState);
  const parserRef = useRef<IncrementalQWebParser>(new IncrementalQWebParser());
  const accumulatedContentRef = useRef<string>("");
  const lastCssRef = useRef<string>("");
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Start a new streaming session
  const startStreaming = useCallback(() => {
    parserRef.current.reset();
    accumulatedContentRef.current = "";
    lastCssRef.current = "";

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    setState({
      ...initialState,
      isStreaming: true,
      lastUpdateTime: Date.now(),
    });
  }, []);

  // Update content with full message content (debounced)
  // ROOT CAUSE FIX: ChatPanel sends full content, not incremental chunks
  // So we REPLACE instead of appending to avoid content duplication
  const updateContent = useCallback((fullContent: string) => {
    // CRITICAL: Replace, don't append - ChatPanel sends full content each time
    accumulatedContentRef.current = fullContent;

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce updates to avoid too frequent re-renders
    updateTimeoutRef.current = setTimeout(() => {
      const content = accumulatedContentRef.current;

      try {
        // Parse full content (reset parser first since we're parsing full content)
        parserRef.current.reset();
        const result = parserRef.current.addChunk(content);

        // Extract CSS from SCSS blocks
        const scssMatch = content.match(/```(?:scss|css)([\s\S]*?)```/g);
        let extractedCss = "";
        if (scssMatch) {
          extractedCss = scssMatch
            .map((block) => {
              const inner = block.replace(/```(?:scss|css)?/g, "").trim();
              return extractCssFromScss(inner);
            })
            .join("\n");
          lastCssRef.current = extractedCss;
        }

        setState((prevState) => ({
          ...prevState,
          partialHtml: result.completedHtml + result.partialHtml,
          partialCss: extractedCss || lastCssRef.current,
          lastUpdateTime: Date.now(),
          completedTemplates: result.templateCount,
          parseError: result.errors.length > 0 ? result.errors[0] : null,
          streamProgress: result.isComplete
            ? 100
            : Math.min(95, prevState.streamProgress + 2),
        }));
      } catch (error) {
        setState((prevState) => ({
          ...prevState,
          parseError: error instanceof Error ? error.message : "Parse error",
          lastUpdateTime: Date.now(),
        }));
      }
    }, debounceMs);
  }, [debounceMs]);

  // End streaming session
  const endStreaming = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    setState((prevState) => ({
      ...prevState,
      isStreaming: false,
      streamProgress: 100,
      lastUpdateTime: Date.now(),
    }));
  }, []);

  // Reset preview state
  const resetPreview = useCallback(() => {
    parserRef.current.reset();
    accumulatedContentRef.current = "";
    lastCssRef.current = "";

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    setState(initialState);
  }, []);

  // Get latest HTML (with sanitization)
  const getLatestHtml = useCallback(() => {
    return state.partialHtml;
  }, [state.partialHtml]);

  // Get latest CSS
  const getLatestCss = useCallback(() => {
    return state.partialCss;
  }, [state.partialCss]);

  const value = useMemo<StreamingPreviewContextValue>(
    () => ({
      ...state,
      startStreaming,
      updateContent,
      endStreaming,
      resetPreview,
      getLatestHtml,
      getLatestCss,
    }),
    [
      state,
      startStreaming,
      updateContent,
      endStreaming,
      resetPreview,
      getLatestHtml,
      getLatestCss,
    ]
  );

  return (
    <StreamingPreviewContext.Provider value={value}>
      {children}
    </StreamingPreviewContext.Provider>
  );
}

/**
 * Hook for checking if streaming is active
 */
export function useIsStreaming(): boolean {
  const context = useContext(StreamingPreviewContext);
  return context?.isStreaming ?? false;
}

/**
 * Hook for streaming progress
 */
export function useStreamingProgress(): number {
  const context = useContext(StreamingPreviewContext);
  return context?.streamProgress ?? 0;
}
