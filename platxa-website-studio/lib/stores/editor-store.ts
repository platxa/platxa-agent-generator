import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";
import { safeLocalStorage } from "./safe-storage";

/**
 * Open tab in the editor
 */
export interface EditorTab {
  path: string;
  name: string;
  language: string;
  isModified: boolean;
  isPinned: boolean;
}

/**
 * Editor cursor position
 */
export interface CursorPosition {
  line: number;
  column: number;
}

/**
 * Selection range
 */
export interface SelectionRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Editor state interface
 */
interface EditorState {
  // Tabs
  openTabs: EditorTab[];
  activeTab: string | null;

  // Editor state
  cursorPosition: CursorPosition;
  selection: SelectionRange | null;

  // File contents (in-memory for generated files)
  fileContents: Record<string, string>;

  // CRITICAL: Timestamp to force React re-renders when files change
  // This bypasses any reference equality issues with fileContents object
  lastFileUpdate: number;

  // View state
  showMinimap: boolean;
  wordWrap: boolean;
  fontSize: number;

  // Diff view
  showDiff: boolean;
  diffOriginal: string | null;
  diffModified: string | null;

  // Snippet selection (from preview click-to-select)
  selectedSnippetId: string | null;
  selectedSnippetElement: string | null;

  // Snippet regeneration request
  snippetRegenRequest: {
    snippetId: string;
    position: { x: number; y: number };
  } | null;

  // Actions
  openTab: (tab: Omit<EditorTab, "isModified" | "isPinned">) => void;
  closeTab: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (path: string) => void;
  pinTab: (path: string) => void;
  unpinTab: (path: string) => void;
  markTabModified: (path: string, isModified: boolean) => void;
  setCursorPosition: (position: CursorPosition) => void;
  setSelection: (selection: SelectionRange | null) => void;
  setFileContent: (path: string, content: string) => void;
  getFileContent: (path: string) => string | undefined;
  clearFileContent: (path: string) => void;
  clearAllFileContents: () => void;
  toggleMinimap: () => void;
  toggleWordWrap: () => void;
  setFontSize: (size: number) => void;
  showDiffView: (original: string, modified: string) => void;
  hideDiffView: () => void;
  selectSnippet: (snippetId: string | null, element?: string | null) => void;
  clearSnippetSelection: () => void;
  requestSnippetRegen: (snippetId: string, position: { x: number; y: number }) => void;
  clearSnippetRegenRequest: () => void;

  // Bulk operations for generated files
  openGeneratedFiles: (files: Array<{ path: string; content: string; language: string }>) => void;
}

/**
 * Detect language from file path
 */
function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    py: "python",
    xml: "xml",
    html: "html",
    scss: "scss",
    css: "css",
    js: "javascript",
    ts: "typescript",
    tsx: "typescriptreact",
    jsx: "javascriptreact",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
  };
  return languageMap[ext || ""] || "plaintext";
}

/**
 * Editor store - manages editor tabs and state with persistence
 */
export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      openTabs: [],
      activeTab: null,
      cursorPosition: { line: 1, column: 1 },
      selection: null,
      fileContents: {},
      lastFileUpdate: 0,
      showMinimap: true,
      wordWrap: false,
      fontSize: 14,
      showDiff: false,
      diffOriginal: null,
      diffModified: null,
      selectedSnippetId: null,
      selectedSnippetElement: null,
      snippetRegenRequest: null,

      // Actions
      openTab: (tab) =>
        set((state) => {
          // Check if tab already exists
          const existingTab = state.openTabs.find((t) => t.path === tab.path);
          if (existingTab) {
            return { activeTab: tab.path };
          }

          // Add new tab
          const newTab: EditorTab = {
            ...tab,
            isModified: false,
            isPinned: false,
          };

          return {
            openTabs: [...state.openTabs, newTab],
            activeTab: tab.path,
          };
        }),

      closeTab: (path) =>
        set((state) => {
          const tabIndex = state.openTabs.findIndex((t) => t.path === path);
          if (tabIndex === -1) return state;

          const newTabs = state.openTabs.filter((t) => t.path !== path);
          let newActiveTab = state.activeTab;

          // If closing active tab, select adjacent tab
          if (state.activeTab === path) {
            if (newTabs.length === 0) {
              newActiveTab = null;
            } else if (tabIndex >= newTabs.length) {
              newActiveTab = newTabs[newTabs.length - 1].path;
            } else {
              newActiveTab = newTabs[tabIndex].path;
            }
          }

          // Clear file content for this tab
          const newFileContents = { ...state.fileContents };
          delete newFileContents[path];

          return {
            openTabs: newTabs,
            activeTab: newActiveTab,
            fileContents: newFileContents,
          };
        }),

      closeOtherTabs: (path) =>
        set((state) => {
          const tab = state.openTabs.find((t) => t.path === path);
          if (!tab) return state;

          // Keep pinned tabs and the current tab
          const newTabs = state.openTabs.filter(
            (t) => t.path === path || t.isPinned
          );

          // Clear file contents for closed tabs
          const newFileContents: Record<string, string> = {};
          for (const t of newTabs) {
            if (state.fileContents[t.path]) {
              newFileContents[t.path] = state.fileContents[t.path];
            }
          }

          return {
            openTabs: newTabs,
            activeTab: path,
            fileContents: newFileContents,
          };
        }),

      closeAllTabs: () =>
        set((state) => {
          // Keep only pinned tabs
          const pinnedTabs = state.openTabs.filter((t) => t.isPinned);

          // Keep file contents only for pinned tabs
          const newFileContents: Record<string, string> = {};
          for (const t of pinnedTabs) {
            if (state.fileContents[t.path]) {
              newFileContents[t.path] = state.fileContents[t.path];
            }
          }

          return {
            openTabs: pinnedTabs,
            activeTab: pinnedTabs.length > 0 ? pinnedTabs[0].path : null,
            fileContents: newFileContents,
          };
        }),

      setActiveTab: (path) => set({ activeTab: path }),

      pinTab: (path) =>
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            t.path === path ? { ...t, isPinned: true } : t
          ),
        })),

      unpinTab: (path) =>
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            t.path === path ? { ...t, isPinned: false } : t
          ),
        })),

      markTabModified: (path, isModified) =>
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            t.path === path ? { ...t, isModified } : t
          ),
        })),

      setCursorPosition: (position) => set({ cursorPosition: position }),

      setSelection: (selection) => set({ selection }),

      setFileContent: (path, content) =>
        set((state) => ({
          fileContents: { ...state.fileContents, [path]: content },
        })),

      getFileContent: (path) => get().fileContents[path],

      clearFileContent: (path) =>
        set((state) => {
          const newFileContents = { ...state.fileContents };
          delete newFileContents[path];
          return { fileContents: newFileContents };
        }),

      clearAllFileContents: () => set({ fileContents: {} }),

      toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),

      toggleWordWrap: () => set((state) => ({ wordWrap: !state.wordWrap })),

      setFontSize: (size) => set({ fontSize: Math.max(10, Math.min(24, size)) }),

      showDiffView: (original, modified) =>
        set({
          showDiff: true,
          diffOriginal: original,
          diffModified: modified,
        }),

      hideDiffView: () =>
        set({
          showDiff: false,
          diffOriginal: null,
          diffModified: null,
        }),

      selectSnippet: (snippetId, element = null) =>
        set({ selectedSnippetId: snippetId, selectedSnippetElement: element }),

      clearSnippetSelection: () =>
        set({ selectedSnippetId: null, selectedSnippetElement: null }),

      requestSnippetRegen: (snippetId, position) =>
        set({ snippetRegenRequest: { snippetId, position } }),

      clearSnippetRegenRequest: () =>
        set({ snippetRegenRequest: null }),

      // Bulk open generated files from AI
      openGeneratedFiles: (files) =>
        set((state) => {
          console.log("[EditorStore] ===== openGeneratedFiles called =====");
          console.log("[EditorStore] Incoming files:", files.length);
          files.forEach(f => console.log(`[EditorStore]   - ${f.path}: ${f.content.length} chars`));

          const newTabs = [...state.openTabs];
          const newFileContents = { ...state.fileContents };
          let firstNewTab: string | null = null;

          for (const file of files) {
            // Check if tab already exists
            const existingTab = newTabs.find((t) => t.path === file.path);

            if (!existingTab) {
              // Add new tab
              const fileName = file.path.split("/").pop() || file.path;
              newTabs.push({
                path: file.path,
                name: fileName,
                language: file.language || detectLanguage(file.path),
                isModified: true,
                isPinned: false,
              });

              if (!firstNewTab) {
                firstNewTab = file.path;
              }
            }

            // Store file content
            newFileContents[file.path] = file.content;
          }

          console.log("[EditorStore] New fileContents keys:", Object.keys(newFileContents));
          console.log("[EditorStore] Total files in store:", Object.keys(newFileContents).length);

          // CRITICAL: Update timestamp to force React re-renders
          const updateTime = Date.now();
          console.log("[EditorStore] Setting lastFileUpdate to:", updateTime);

          return {
            openTabs: newTabs,
            activeTab: firstNewTab || state.activeTab,
            fileContents: newFileContents,
            lastFileUpdate: updateTime,
          };
        }),
    }),
    {
      name: "platxa-editor-storage",
      storage: createJSONStorage(() => safeLocalStorage),
      // Persist tabs, settings, and file contents
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTab: state.activeTab,
        fileContents: state.fileContents,
        showMinimap: state.showMinimap,
        wordWrap: state.wordWrap,
        fontSize: state.fontSize,
      }),
      // Skip hydration on server - handle manually on client
      skipHydration: true,
    }
  )
);

/**
 * Hook to ensure store is hydrated before use (SSR-safe)
 * Use this in components that depend on persisted state
 *
 * FIX: Use lazy initializer to check hydration status immediately,
 * avoiding the race condition where hasHydrated() is true but state is false
 */
export function useEditorStoreHydration() {
  // Simple approach: track if we're on client and hydration attempted
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // We're on the client now - trigger hydration
    const persist = useEditorStore.persist;

    // Subscribe to finish event
    const unsub = persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // Check if already hydrated
    if (persist.hasHydrated()) {
      setHydrated(true);
    } else {
      // Trigger rehydration
      persist.rehydrate();
    }

    // FAILSAFE: If hydration doesn't complete in 500ms, force it
    // This handles edge cases where localStorage is slow or unavailable
    const failsafe = setTimeout(() => {
      if (!persist.hasHydrated()) {
        console.warn("[EditorStore] Hydration timeout - forcing completion");
      }
      setHydrated(true);
    }, 500);

    return () => {
      unsub();
      clearTimeout(failsafe);
    };
  }, []);

  return hydrated;
}

/**
 * Hook to safely access editor store with hydration check
 * Returns empty state until hydration is complete
 */
export function useEditorStoreHydrated<T>(selector: (state: EditorState) => T): T {
  const hydrated = useEditorStoreHydration();
  const value = useEditorStore(selector);
  const initialValue = useEditorStore.getInitialState();

  // Return initial state during SSR/before hydration
  if (!hydrated) {
    return selector(initialValue as EditorState);
  }

  return value;
}

/**
 * Selector for checking if there are unsaved changes
 */
export const selectHasUnsavedChanges = (state: EditorState): boolean => {
  return state.openTabs.some((tab) => tab.isModified);
};

/**
 * Selector for getting unsaved file paths
 */
export const selectUnsavedFilePaths = (state: EditorState): string[] => {
  return state.openTabs.filter((tab) => tab.isModified).map((tab) => tab.path);
};
