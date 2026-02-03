/**
 * Write File Tool - Production-grade file writing with Yjs document sync
 *
 * Features:
 * - Atomic file writing with backup support
 * - Automatic Yjs Y.Doc sync for real-time collaboration
 * - Directory creation if needed
 * - Encoding support
 * - Write verification
 *
 * @module agentic-core/tools/write-file
 */

import { writeFile as fsWriteFile, mkdir, stat, rename, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, resolve, isAbsolute } from 'path';
import { Y, type YDoc } from '@/lib/yjs-singleton';
import type { ToolParams, ToolResult } from '../tool-executor';

// ============================================================================
// Types
// ============================================================================

/** Options for writing files */
export interface WriteFileOptions {
  /** File path to write */
  path: string;
  /** Content to write */
  content: string;
  /** Base directory for relative paths */
  baseDir?: string;
  /** Create parent directories if they don't exist */
  createDirs?: boolean;
  /** Create backup of existing file before overwrite */
  backup?: boolean;
  /** Encoding to use (default: utf-8) */
  encoding?: BufferEncoding;
  /** Y.Doc instance for real-time sync (optional) */
  yDoc?: YDoc;
  /** Document ID for Yjs sync */
  docId?: string;
}

/** Result from writing a file */
export interface WriteFileResult {
  /** File path that was written */
  path: string;
  /** Number of bytes written */
  bytesWritten: number;
  /** Whether directories were created */
  dirsCreated: boolean;
  /** Path to backup file (if created) */
  backupPath?: string;
  /** Whether Yjs sync was performed */
  yjsSynced: boolean;
  /** Time taken for Yjs sync in ms */
  yjsSyncTime?: number;
}

/** Yjs document manager for file sync */
export interface YjsDocManager {
  /** Get or create Y.Doc for a file path */
  getDoc(docId: string): YDoc;
  /** Notify connected clients of update */
  broadcastUpdate(docId: string, update: Uint8Array): void;
}

// ============================================================================
// Yjs Document Registry
// ============================================================================

/** Global registry of Y.Doc instances for file sync */
class YjsDocRegistry {
  private docs: Map<string, YDoc> = new Map();
  private updateListeners: Map<string, Set<(update: Uint8Array) => void>> = new Map();

  /**
   * Get or create a Y.Doc for a document ID
   */
  getDoc(docId: string): YDoc {
    let doc = this.docs.get(docId);
    if (!doc) {
      doc = new Y.Doc();
      this.docs.set(docId, doc);
    }
    return doc;
  }

  /**
   * Update Y.Doc content and broadcast to listeners
   * Returns the sync time in milliseconds
   */
  updateDoc(docId: string, content: string): { syncTime: number; update: Uint8Array } {
    const startTime = performance.now();

    const doc = this.getDoc(docId);
    const yText = doc.getText('content');

    // Transact the update for efficiency
    doc.transact(() => {
      // Clear existing content and set new
      yText.delete(0, yText.length);
      yText.insert(0, content);
    });

    // Get the encoded update for broadcasting
    const update = Y.encodeStateAsUpdate(doc);

    // Broadcast to listeners
    const listeners = this.updateListeners.get(docId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(update);
        } catch {
          // Ignore listener errors
        }
      }
    }

    const syncTime = performance.now() - startTime;
    return { syncTime, update };
  }

  /**
   * Subscribe to updates for a document
   */
  subscribe(docId: string, listener: (update: Uint8Array) => void): () => void {
    if (!this.updateListeners.has(docId)) {
      this.updateListeners.set(docId, new Set());
    }
    this.updateListeners.get(docId)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.updateListeners.get(docId)?.delete(listener);
    };
  }

  /**
   * Get current content from Y.Doc
   */
  getContent(docId: string): string {
    const doc = this.docs.get(docId);
    if (!doc) return '';
    return doc.getText('content').toString();
  }

  /**
   * Check if a document exists
   */
  hasDoc(docId: string): boolean {
    return this.docs.has(docId);
  }

  /**
   * Remove a document from the registry
   */
  removeDoc(docId: string): void {
    const doc = this.docs.get(docId);
    if (doc) {
      doc.destroy();
      this.docs.delete(docId);
      this.updateListeners.delete(docId);
    }
  }

  /**
   * Get all document IDs
   */
  getDocIds(): string[] {
    return Array.from(this.docs.keys());
  }

  /**
   * Clear all documents (for testing)
   */
  clear(): void {
    for (const doc of this.docs.values()) {
      doc.destroy();
    }
    this.docs.clear();
    this.updateListeners.clear();
  }
}

// Global Yjs document registry singleton
export const yjsRegistry = new YjsDocRegistry();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Resolve file path relative to base directory
 */
function resolvePath(filePath: string, baseDir?: string): string {
  if (isAbsolute(filePath)) {
    return filePath;
  }
  return resolve(baseDir || process.cwd(), filePath);
}

/**
 * Generate backup path for a file
 */
function getBackupPath(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${filePath}.backup-${timestamp}`;
}

/**
 * Create parent directories if they don't exist
 */
async function ensureDir(filePath: string): Promise<boolean> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    return true;
  }
  return false;
}

// ============================================================================
// Main Implementation
// ============================================================================

/**
 * Write a file with optional Yjs document sync
 *
 * @param options - Write file options
 * @returns Write result with sync information
 */
export async function writeFileImpl(options: WriteFileOptions): Promise<WriteFileResult> {
  const filePath = resolvePath(options.path, options.baseDir);
  const encoding = options.encoding ?? 'utf-8';
  const content = options.content;

  let dirsCreated = false;
  let backupPath: string | undefined;
  let yjsSynced = false;
  let yjsSyncTime: number | undefined;

  // Create parent directories if needed
  if (options.createDirs !== false) {
    dirsCreated = await ensureDir(filePath);
  }

  // Create backup if file exists and backup is enabled
  if (options.backup && existsSync(filePath)) {
    backupPath = getBackupPath(filePath);
    await rename(filePath, backupPath);
  }

  try {
    // Write file atomically (write to temp, then rename)
    const tempPath = `${filePath}.tmp`;
    await fsWriteFile(tempPath, content, { encoding });

    // Verify write
    const stats = await stat(tempPath);
    if (stats.size !== Buffer.byteLength(content, encoding)) {
      throw new Error('Write verification failed: size mismatch');
    }

    // Rename temp to final (atomic on most filesystems)
    await rename(tempPath, filePath);

    // Sync to Yjs if configured
    if (options.yDoc || options.docId) {
      const docId = options.docId || filePath;
      const { syncTime } = yjsRegistry.updateDoc(docId, content);
      yjsSynced = true;
      yjsSyncTime = syncTime;
    }

    return {
      path: filePath,
      bytesWritten: Buffer.byteLength(content, encoding),
      dirsCreated,
      backupPath,
      yjsSynced,
      yjsSyncTime,
    };
  } catch (error) {
    // Restore backup on failure
    if (backupPath && existsSync(backupPath)) {
      try {
        await rename(backupPath, filePath);
      } catch {
        // Ignore restore error
      }
    }

    // Clean up temp file if it exists
    const tempPath = `${filePath}.tmp`;
    if (existsSync(tempPath)) {
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup error
      }
    }

    throw error;
  }
}

// ============================================================================
// Tool Integration
// ============================================================================

/**
 * Write file tool for AgentToolExecutor
 *
 * Implements the ToolFunction interface with:
 * - Atomic file writing
 * - Automatic Yjs Y.Doc sync for real-time collaboration
 * - Directory creation
 * - Backup support
 */
export async function writeFileTool(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const content = params.options?.content as string;
    if (content === undefined) {
      throw new Error('content is required for write_file');
    }

    const options: WriteFileOptions = {
      path: params.target,
      content,
      baseDir: params.options?.baseDir as string,
      createDirs: params.options?.createDirs as boolean,
      backup: params.options?.backup as boolean,
      encoding: params.options?.encoding as BufferEncoding,
      docId: params.options?.docId as string,
    };

    // Enable Yjs sync by default for real-time collaboration
    if (options.docId === undefined) {
      options.docId = options.path; // Use file path as doc ID
    }

    const result = await writeFileImpl(options);

    return {
      success: true,
      data: {
        path: result.path,
        bytesWritten: result.bytesWritten,
        dirsCreated: result.dirsCreated,
        backupPath: result.backupPath,
        yjsSynced: result.yjsSynced,
        yjsSyncTime: result.yjsSyncTime,
      },
      duration: Date.now() - startTime,
      toolName: 'write_file',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'write_file',
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default writeFileTool;
