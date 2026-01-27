/**
 * Project Config Bridge
 *
 * Syncs the Zustand project store state with the agent pipeline context.
 * When project configuration changes (colors, fonts, industry, files),
 * the bridge automatically updates the agent context so the AI always
 * has access to the latest project config.
 */

import { useProjectStore } from "@/lib/stores/project-store";
import type { ProjectConfig } from "@/lib/stores/project-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { mapOdooPaletteToBrandTokens } from "./color-mapper";
import type { BrandTokenContext, OdooColorPalette } from "./types";

// =============================================================================
// Types
// =============================================================================

/** Full project context available to the agent pipeline */
export interface AgentProjectContext {
  projectId: string | null;
  projectName: string;
  projectConfig: ProjectConfig | null;
  colorPalette: OdooColorPalette | null;
  brandTokens: BrandTokenContext | null;
  existingFiles: string[];
  industry: string | null;
  designStyle: string | null;
  sidecarUrl: string | null;
  odooUrl: string | null;
}

/** Callback invoked when project context changes */
export type ProjectContextChangeHandler = (context: AgentProjectContext) => void;

// =============================================================================
// Bridge
// =============================================================================

/**
 * Derives the full agent project context from the current project store state.
 * This is a pure function — no side effects, no subscriptions.
 */
export function deriveAgentContext(): AgentProjectContext {
  const state = useProjectStore.getState();
  const palette = state.projectConfig?.colorPalette ?? null;

  let brandTokens: BrandTokenContext | null = null;
  if (palette) {
    brandTokens = mapOdooPaletteToBrandTokens(palette);
  }

  // Collect file paths from the tree
  const existingFiles = collectFilePaths(state.files);

  return {
    projectId: state.projectId,
    projectName: state.projectName,
    projectConfig: state.projectConfig,
    colorPalette: palette,
    brandTokens,
    existingFiles,
    industry: state.projectConfig?.industry ?? null,
    designStyle: null, // Derived from industry if needed
    sidecarUrl: state.sidecarUrl,
    odooUrl: state.odooUrl,
  };
}

/**
 * Subscribes to project store changes and invokes the handler whenever
 * the project configuration changes. Also pushes brand tokens into the
 * agent store automatically.
 *
 * Returns an unsubscribe function.
 */
export function subscribeProjectConfigBridge(
  onChange?: ProjectContextChangeHandler,
): () => void {
  let prevSnapshot = snapshotKey(useProjectStore.getState());

  const unsubscribe = useProjectStore.subscribe((state) => {
    const currentSnapshot = snapshotKey(state);

    // Only fire when relevant fields change
    if (currentSnapshot === prevSnapshot) return;
    prevSnapshot = currentSnapshot;

    const context = deriveAgentContext();

    // Sync brand tokens into agent store
    if (context.brandTokens) {
      useAgentStore.getState().setBrandContext(context.brandTokens);
    }

    onChange?.(context);
  });

  // Fire initial sync
  const initialContext = deriveAgentContext();
  if (initialContext.brandTokens) {
    useAgentStore.getState().setBrandContext(initialContext.brandTokens);
  }
  onChange?.(initialContext);

  return unsubscribe;
}

// =============================================================================
// Helpers
// =============================================================================

/** Creates a stable key from the project state fields that matter to the agent */
function snapshotKey(state: ReturnType<typeof useProjectStore.getState>): string {
  return JSON.stringify({
    id: state.projectId,
    name: state.projectName,
    config: state.projectConfig,
    odoo: state.odooUrl,
    sidecar: state.sidecarUrl,
    fileCount: state.files.length,
  });
}

/** Recursively collects all file paths from the file tree */
function collectFilePaths(
  nodes: Array<{ path: string; type: string; children?: Array<{ path: string; type: string; children?: unknown[] }> }>,
): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      paths.push(node.path);
    }
    if (node.type === "directory" && Array.isArray(node.children)) {
      paths.push(...collectFilePaths(node.children as typeof nodes));
    }
  }
  return paths;
}
