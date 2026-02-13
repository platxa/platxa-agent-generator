import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "./safe-storage";

/**
 * File node structure for the project tree
 */
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  content?: string;
  isModified?: boolean;
}

/**
 * Project configuration
 */
export interface ProjectConfig {
  themeName: string;
  displayName: string;
  industry?: string;
  colorPalette?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts?: {
    heading: string;
    body: string;
  };
}

/**
 * Odoo connection status
 */
export type OdooStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Project state interface
 */
interface ProjectState {
  // Project identification
  projectId: string | null;
  projectName: string;
  projectConfig: ProjectConfig | null;

  // File system
  files: FileNode[];
  activeFile: string | null;

  // Odoo connection
  odooUrl: string | null;
  sidecarUrl: string | null;
  odooStatus: OdooStatus;
  odooError: string | null;

  // Pending changes for sync
  pendingChanges: string[];

  // Actions
  setProject: (projectId: string, name: string) => void;
  setProjectConfig: (config: ProjectConfig) => void;
  setFiles: (files: FileNode[]) => void;

  addFile: (file: FileNode) => void;
  updateFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  setOdooConnection: (odooUrl: string, sidecarUrl: string) => void;
  setOdooStatus: (status: OdooStatus, error?: string) => void;
  resetProject: () => void;

  addPendingChange: (path: string) => void;
  clearPendingChanges: () => void;
}

/**
 * Helper to find and update a file in the tree
 */
function updateFileInTree(
  nodes: FileNode[],
  path: string,
  content: string
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === path) {
      return { ...node, content, isModified: true };
    }
    if (node.children) {
      return {
        ...node,
        children: updateFileInTree(node.children, path, content),
      };
    }
    return node;
  });
}

/**
 * Helper to delete a file from the tree
 */
function deleteFileFromTree(nodes: FileNode[], path: string): FileNode[] {
  return nodes
    .filter((node) => node.path !== path)
    .map((node) => {
      if (node.children) {
        return {
          ...node,
          children: deleteFileFromTree(node.children, path),
        };
      }
      return node;
    });
}

/**
 * Helper to add a file to the tree
 */
function addFileToTree(nodes: FileNode[], file: FileNode): FileNode[] {
  const parentPath = file.path.split("/").slice(0, -1).join("/");

  // If it's a root-level file
  if (!parentPath) {
    return [...nodes, file];
  }

  return nodes.map((node) => {
    if (node.path === parentPath && node.type === "directory") {
      return {
        ...node,
        children: [...(node.children || []), file],
      };
    }
    if (node.children) {
      return {
        ...node,
        children: addFileToTree(node.children, file),
      };
    }
    return node;
  });
}

/**
 * Project store - manages project state, files, and Odoo connection
 */
export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      // Initial state
      projectId: null,
      projectName: "Untitled Project",
      projectConfig: null,
      files: [],
      activeFile: null,
      odooUrl: null,
      sidecarUrl: null,
      odooStatus: "disconnected",
      odooError: null,
      pendingChanges: [],

      // Actions
      setProject: (projectId, name) =>
        set({
          projectId,
          projectName: name,
          odooStatus: "disconnected",
          odooError: null,
        }),

      setProjectConfig: (config) =>
        set({
          projectConfig: config,
          projectName: config.displayName,
        }),

      setFiles: (files) => set({ files }),


      addFile: (file) =>
        set((state) => ({
          files: addFileToTree(state.files, file),
        })),

      updateFile: (path, content) =>
        set((state) => ({
          files: updateFileInTree(state.files, path, content),
          // Track as pending change for GitHub sync
          pendingChanges: state.pendingChanges.includes(path)
            ? state.pendingChanges
            : [...state.pendingChanges, path],
        })),

      deleteFile: (path) =>
        set((state) => ({
          files: deleteFileFromTree(state.files, path),
          activeFile: state.activeFile === path ? null : state.activeFile,
        })),

      setActiveFile: (path) => set({ activeFile: path }),

      setOdooConnection: (odooUrl, sidecarUrl) =>
        set({
          odooUrl,
          sidecarUrl,
          odooStatus: "connecting",
        }),

      setOdooStatus: (status, error) =>
        set({
          odooStatus: status,
          odooError: error || null,
        }),

      resetProject: () =>
        set({
          projectId: null,
          projectName: "Untitled Project",
          projectConfig: null,
          files: [],
          activeFile: null,
          odooUrl: null,
          sidecarUrl: null,
          odooStatus: "disconnected",
          odooError: null,
          pendingChanges: [],
        }),

      addPendingChange: (path) =>
        set((state) => ({
          pendingChanges: state.pendingChanges.includes(path)
            ? state.pendingChanges
            : [...state.pendingChanges, path],
        })),

      clearPendingChanges: () =>
        set({ pendingChanges: [] }),
    }),
    {
      name: "platxa-project-storage",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        projectId: state.projectId,
        projectName: state.projectName,
        projectConfig: state.projectConfig,
        files: state.files,
        activeFile: state.activeFile,
      }),
    }
  )
);
