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
  setFilesConsolidated: (files: FileNode[]) => void;
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
 * ROOT CAUSE FIX: Consolidate duplicate XML and SCSS files
 * AI often generates both templates.xml AND pages.xml with duplicate template IDs
 * This merges them into single canonical files BEFORE storing
 */
function consolidateFiles(files: FileNode[]): FileNode[] {
  // Flatten tree to get all files
  const flatFiles: FileNode[] = [];
  const collectFiles = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === "file") {
        flatFiles.push(node);
      } else if (node.children) {
        collectFiles(node.children);
      }
    }
  };
  collectFiles(files);

  // Separate by type
  const xmlFiles = flatFiles.filter(f => f.path.endsWith('.xml') && f.path.includes('/views/'));
  const scssFiles = flatFiles.filter(f => f.path.endsWith('.scss') || f.path.endsWith('.css'));
  const otherFiles = flatFiles.filter(f =>
    !(f.path.endsWith('.xml') && f.path.includes('/views/')) &&
    !f.path.endsWith('.scss') && !f.path.endsWith('.css')
  );

  const consolidated: FileNode[] = [...otherFiles];

  // Consolidate XML files
  if (xmlFiles.length > 1) {
    const seenTemplateIds = new Set<string>();
    const mergedTemplates: string[] = [];

    for (const xmlFile of xmlFiles) {
      const content = xmlFile.content || '';
      const templateRegex = /<template\s+[^>]*id=["']([^"']+)["'][^>]*>[\s\S]*?<\/template>/gi;
      let match;
      while ((match = templateRegex.exec(content)) !== null) {
        const templateId = match[1];
        if (!seenTemplateIds.has(templateId)) {
          seenTemplateIds.add(templateId);
          mergedTemplates.push(match[0]);
        } else {
        }
      }
    }

    if (mergedTemplates.length > 0) {
      consolidated.push({
        id: 'theme_generated/views/templates.xml',
        name: 'templates.xml',
        path: 'theme_generated/views/templates.xml',
        type: 'file',
        content: `<?xml version="1.0" encoding="utf-8"?>\n<odoo>\n  ${mergedTemplates.join('\n\n  ')}\n</odoo>`,
        isModified: true,
      });
    }
  } else if (xmlFiles.length === 1) {
    consolidated.push(xmlFiles[0]);
  }

  // Consolidate SCSS files
  if (scssFiles.length > 1) {
    consolidated.push({
      id: 'theme_generated/static/src/scss/theme.scss',
      name: 'theme.scss',
      path: 'theme_generated/static/src/scss/theme.scss',
      type: 'file',
      content: scssFiles.map(f => `/* From: ${f.path} */\n${f.content || ''}`).join('\n\n'),
      isModified: true,
    });
  } else if (scssFiles.length === 1) {
    consolidated.push(scssFiles[0]);
  }

  // Rebuild tree structure from consolidated flat files
  return buildTreeFromFiles(consolidated);
}

/**
 * Build tree structure from flat file list
 */
function buildTreeFromFiles(files: FileNode[]): FileNode[] {
  const root: FileNode[] = [];
  const dirs = new Map<string, FileNode>();

  for (const file of files) {
    const parts = file.path.split('/');
    let currentPath = '';
    let currentArray = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        // Add the file
        currentArray.push({
          ...file,
          name: part,
        });
      } else {
        // Ensure directory exists
        if (!dirs.has(currentPath)) {
          const dir: FileNode = {
            id: currentPath,
            name: part,
            path: currentPath,
            type: 'directory',
            children: [],
          };
          currentArray.push(dir);
          dirs.set(currentPath, dir);
        }
        currentArray = dirs.get(currentPath)!.children!;
      }
    }
  }

  return root;
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

      // ROOT CAUSE FIX: Consolidate files before storing
      setFilesConsolidated: (files) => {
        const consolidated = consolidateFiles(files);
        set({ files: consolidated });
      },

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
