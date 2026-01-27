/**
 * Sidecar Writer
 *
 * Writes generated files through the editor-sync sidecar REST API.
 * Gracefully degrades when the sidecar is unavailable (local dev).
 */

import type { WriteResult, FileWriteStatus } from "./types";

interface GeneratedFile {
  path: string;
  content: string;
}

// =============================================================================
// Sidecar Health Check
// =============================================================================

/**
 * Checks if the editor-sync sidecar is reachable.
 */
async function isSidecarAvailable(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// Write Through Sidecar
// =============================================================================

/**
 * Writes a single file through the sidecar REST API.
 */
async function writeFileThroughSidecar(
  baseUrl: string,
  file: GeneratedFile,
  authToken?: string,
): Promise<FileWriteStatus> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const res = await fetch(
      `${baseUrl}/files/${encodeURIComponent(file.path)}`,
      {
        method: "PUT",
        headers,
        body: file.content,
      },
    );

    if (!res.ok) {
      const error = await res.text();
      return { path: file.path, success: false, error };
    }

    return { path: file.path, success: true };
  } catch (error) {
    return {
      path: file.path,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Public API
// =============================================================================

export interface SidecarWriteOptions {
  /** Editor-sync sidecar base URL (e.g. http://localhost:8765) */
  sidecarBaseUrl: string;
  /** Auth token for sidecar API */
  authToken?: string;
}

/**
 * Writes generated files through the editor-sync sidecar.
 * Returns a WriteResult indicating success/failure per file.
 *
 * If the sidecar is unavailable, returns a result with usedSidecar=false
 * and all files marked as not written (caller can fall back to local store).
 */
export async function writeThroughSidecar(
  files: GeneratedFile[],
  options: SidecarWriteOptions,
): Promise<WriteResult> {
  const { sidecarBaseUrl, authToken } = options;

  // Check sidecar availability
  const available = await isSidecarAvailable(sidecarBaseUrl);
  if (!available) {
    return {
      success: false,
      filesWritten: files.map((f) => ({
        path: f.path,
        success: false,
        error: "Sidecar unavailable",
      })),
      totalFiles: files.length,
      failedFiles: files.length,
      usedSidecar: false,
    };
  }

  // Write all files in parallel
  const results = await Promise.all(
    files.map((f) => writeFileThroughSidecar(sidecarBaseUrl, f, authToken)),
  );

  const failedFiles = results.filter((r) => !r.success).length;

  return {
    success: failedFiles === 0,
    filesWritten: results,
    totalFiles: files.length,
    failedFiles,
    usedSidecar: true,
  };
}
