/**
 * Incremental Theme Deployment
 *
 * Computes file diffs and pushes only changed files to an Odoo instance
 * via XML-RPC, then triggers module upgrade.
 */

// =============================================================================
// Types
// =============================================================================

export interface DeployFileEntry {
  /** Relative path within the theme module */
  path: string;
  /** File content */
  content: string;
  /** SHA-256 hash of content */
  hash: string;
}

export interface FileManifest {
  /** Module technical name */
  moduleName: string;
  /** Map of path → hash */
  files: Record<string, string>;
  /** Timestamp of manifest creation */
  timestamp: number;
}

export interface FileDiff {
  /** New or modified files */
  changed: string[];
  /** Removed files */
  removed: string[];
  /** Unchanged files */
  unchanged: string[];
}

export type DeployStepStatus = "pending" | "running" | "success" | "error";

export interface DeployStep {
  name: string;
  status: DeployStepStatus;
  detail?: string;
}

export interface DeployResult {
  /** Whether the deployment succeeded */
  success: boolean;
  /** Files that were uploaded */
  uploadedFiles: string[];
  /** Files that were removed */
  removedFiles: string[];
  /** Files that were unchanged */
  unchangedFiles: string[];
  /** Module upgraded */
  moduleUpgraded: boolean;
  /** Ordered steps */
  steps: DeployStep[];
  /** Error message if failed */
  error?: string;
  /** Duration (ms) */
  durationMs: number;
}

export interface OdooConnection {
  /** Odoo base URL */
  url: string;
  /** Database name */
  db: string;
  /** User ID */
  uid: number;
  /** Password or API key */
  password: string;
}

export interface DeployConfig {
  /** Odoo connection */
  connection: OdooConnection;
  /** Module technical name */
  moduleName: string;
  /** Max concurrent uploads */
  concurrency: number;
}

export interface DeployState {
  /** Current manifest (last deployed) */
  currentManifest: FileManifest | null;
  /** Deploy history */
  history: DeployResult[];
  config: DeployConfig;
}

// =============================================================================
// Hashing
// =============================================================================

/** Simple deterministic hash for content (non-crypto, for diffing). */
export function hashContent(content: string): string {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) - h + content.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// =============================================================================
// State
// =============================================================================

export function createDeployState(config: DeployConfig): DeployState {
  return {
    currentManifest: null,
    history: [],
    config,
  };
}

// =============================================================================
// Manifest
// =============================================================================

export function buildManifest(
  moduleName: string,
  files: DeployFileEntry[],
  timestamp: number = Date.now(),
): FileManifest {
  const manifest: FileManifest = {
    moduleName,
    files: {},
    timestamp,
  };
  for (const f of files) {
    manifest.files[f.path] = f.hash;
  }
  return manifest;
}

export function buildFileEntries(
  files: Array<{ path: string; content: string }>,
): DeployFileEntry[] {
  return files.map((f) => ({
    path: f.path,
    content: f.content,
    hash: hashContent(f.content),
  }));
}

// =============================================================================
// Diff
// =============================================================================

export function computeDiff(
  previous: FileManifest | null,
  current: FileManifest,
): FileDiff {
  const changed: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  const prevFiles = previous?.files ?? {};

  // Check current files against previous
  for (const [path, hash] of Object.entries(current.files)) {
    if (!(path in prevFiles)) {
      changed.push(path);
    } else if (prevFiles[path] !== hash) {
      changed.push(path);
    } else {
      unchanged.push(path);
    }
  }

  // Check for removed files
  for (const path of Object.keys(prevFiles)) {
    if (!(path in current.files)) {
      removed.push(path);
    }
  }

  return { changed, removed, unchanged };
}

// =============================================================================
// Deployment Steps (simulated XML-RPC operations)
// =============================================================================

export interface XmlRpcAdapter {
  /** Upload a file to Odoo */
  uploadFile(path: string, content: string): Promise<boolean>;
  /** Remove a file from Odoo */
  removeFile(path: string): Promise<boolean>;
  /** Trigger module upgrade */
  upgradeModule(moduleName: string): Promise<boolean>;
}

function makeStep(name: string, status: DeployStepStatus, detail?: string): DeployStep {
  return { name, status, detail };
}

/** Run uploads with bounded concurrency. */
async function uploadWithConcurrency(
  adapter: XmlRpcAdapter,
  files: DeployFileEntry[],
  concurrency: number,
): Promise<{ uploaded: string[]; failed: string[] }> {
  const uploaded: string[] = [];
  const failed: string[] = [];
  let idx = 0;

  async function next(): Promise<void> {
    while (idx < files.length) {
      const current = idx++;
      const file = files[current];
      try {
        const ok = await adapter.uploadFile(file.path, file.content);
        if (ok) uploaded.push(file.path);
        else failed.push(file.path);
      } catch {
        failed.push(file.path);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => next());
  await Promise.all(workers);
  return { uploaded, failed };
}

/** Run removals sequentially. */
async function removeFiles(
  adapter: XmlRpcAdapter,
  paths: string[],
): Promise<{ removed: string[]; failed: string[] }> {
  const removed: string[] = [];
  const failed: string[] = [];
  for (const p of paths) {
    try {
      const ok = await adapter.removeFile(p);
      if (ok) removed.push(p);
      else failed.push(p);
    } catch {
      failed.push(p);
    }
  }
  return { removed, failed };
}

// =============================================================================
// Main Deploy
// =============================================================================

export async function deploy(
  state: DeployState,
  fileEntries: DeployFileEntry[],
  adapter: XmlRpcAdapter,
  timestamp: number = Date.now(),
): Promise<{ state: DeployState; result: DeployResult }> {
  const startTime = timestamp;
  const steps: DeployStep[] = [];

  // Step 1: Build manifest
  const newManifest = buildManifest(state.config.moduleName, fileEntries, timestamp);
  steps.push(makeStep("build_manifest", "success", `${fileEntries.length} files`));

  // Step 2: Compute diff
  const diff = computeDiff(state.currentManifest, newManifest);
  steps.push(makeStep("compute_diff", "success",
    `${diff.changed.length} changed, ${diff.removed.length} removed, ${diff.unchanged.length} unchanged`));

  // Step 3: Upload changed files
  const changedEntries = fileEntries.filter((f) => diff.changed.includes(f.path));
  let uploadedFiles: string[] = [];
  if (changedEntries.length > 0) {
    steps.push(makeStep("upload_files", "running"));
    const uploadResult = await uploadWithConcurrency(adapter, changedEntries, state.config.concurrency);
    uploadedFiles = uploadResult.uploaded;
    if (uploadResult.failed.length > 0) {
      steps[steps.length - 1] = makeStep("upload_files", "error",
        `Failed: ${uploadResult.failed.join(", ")}`);
      const result: DeployResult = {
        success: false,
        uploadedFiles,
        removedFiles: [],
        unchangedFiles: diff.unchanged,
        moduleUpgraded: false,
        steps,
        error: `Upload failed for: ${uploadResult.failed.join(", ")}`,
        durationMs: Date.now() - startTime,
      };
      return { state: { ...state, history: [...state.history, result] }, result };
    }
    steps[steps.length - 1] = makeStep("upload_files", "success", `${uploadedFiles.length} files`);
  } else {
    steps.push(makeStep("upload_files", "success", "No files to upload"));
  }

  // Step 4: Remove deleted files
  let removedFiles: string[] = [];
  if (diff.removed.length > 0) {
    steps.push(makeStep("remove_files", "running"));
    const removeResult = await removeFiles(adapter, diff.removed);
    removedFiles = removeResult.removed;
    if (removeResult.failed.length > 0) {
      steps[steps.length - 1] = makeStep("remove_files", "error",
        `Failed: ${removeResult.failed.join(", ")}`);
      // Continue anyway — removal failures are non-fatal
    } else {
      steps[steps.length - 1] = makeStep("remove_files", "success", `${removedFiles.length} files`);
    }
  }

  // Step 5: Upgrade module
  let moduleUpgraded = false;
  if (diff.changed.length > 0 || diff.removed.length > 0) {
    steps.push(makeStep("upgrade_module", "running"));
    try {
      moduleUpgraded = await adapter.upgradeModule(state.config.moduleName);
      steps[steps.length - 1] = makeStep("upgrade_module",
        moduleUpgraded ? "success" : "error",
        moduleUpgraded ? state.config.moduleName : "Upgrade failed");
    } catch (e) {
      steps[steps.length - 1] = makeStep("upgrade_module", "error",
        e instanceof Error ? e.message : "Unknown error");
    }
  } else {
    steps.push(makeStep("upgrade_module", "success", "No changes, skipped"));
    moduleUpgraded = true;
  }

  const result: DeployResult = {
    success: moduleUpgraded,
    uploadedFiles,
    removedFiles,
    unchangedFiles: diff.unchanged,
    moduleUpgraded,
    steps,
    durationMs: Date.now() - startTime,
  };

  return {
    state: {
      ...state,
      currentManifest: moduleUpgraded ? newManifest : state.currentManifest,
      history: [...state.history, result],
    },
    result,
  };
}

// =============================================================================
// Queries
// =============================================================================

export function getLastDeploy(state: DeployState): DeployResult | null {
  return state.history.length > 0 ? state.history[state.history.length - 1] : null;
}

export function getDeployCount(state: DeployState): number {
  return state.history.length;
}

export function getSuccessRate(state: DeployState): number {
  if (state.history.length === 0) return 0;
  return state.history.filter((r) => r.success).length / state.history.length;
}
