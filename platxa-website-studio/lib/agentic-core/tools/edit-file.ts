/**
 * Edit File Tool - Search/replace operations with diff output
 *
 * Features:
 * - Array of { search, replace, all } operations
 * - Unified diff output showing changes
 * - Atomic updates with backup support
 * - Yjs sync integration
 *
 * @module agentic-core/tools/edit-file
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import type { ToolParams, ToolResult } from '../tool-executor';
import { yjsRegistry } from './write-file';

// ============================================================================
// Types
// ============================================================================

/** Single search/replace operation */
export interface EditOperation {
  /** Text to search for */
  search: string;
  /** Text to replace with */
  replace: string;
  /** Replace all occurrences (default: false = first only) */
  all?: boolean;
}

/** Options for editing files */
export interface EditFileOptions {
  /** File path to edit */
  path: string;
  /** Array of edit operations to apply */
  operations: EditOperation[];
  /** Base directory for relative paths */
  baseDir?: string;
  /** Create backup before editing */
  backup?: boolean;
  /** Document ID for Yjs sync */
  docId?: string;
  /** Encoding to use (default: utf-8) */
  encoding?: BufferEncoding;
}

/** Result from editing a file */
export interface EditFileResult {
  /** File path that was edited */
  path: string;
  /** Number of operations applied */
  operationsApplied: number;
  /** Total replacements made */
  totalReplacements: number;
  /** Unified diff of changes */
  diff: string;
  /** Whether Yjs sync was performed */
  yjsSynced: boolean;
  /** Original content (for undo) */
  originalContent?: string;
}

// ============================================================================
// Diff Generation
// ============================================================================

/**
 * Generate unified diff between two strings
 */
function generateUnifiedDiff(
  filePath: string,
  original: string,
  modified: string
): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  const diff: string[] = [];
  diff.push(`--- a/${filePath}`);
  diff.push(`+++ b/${filePath}`);

  // Simple line-by-line diff (for production, could use a proper diff algorithm)
  let hunkStart = -1;
  let hunkLines: string[] = [];
  let originalLine = 0;
  let modifiedLine = 0;

  const maxLines = Math.max(originalLines.length, modifiedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i];
    const modLine = modifiedLines[i];

    if (origLine !== modLine) {
      if (hunkStart === -1) {
        hunkStart = i;
        // Add context before (up to 3 lines)
        for (let j = Math.max(0, i - 3); j < i; j++) {
          if (originalLines[j] !== undefined) {
            hunkLines.push(` ${originalLines[j]}`);
          }
        }
      }

      if (origLine !== undefined) {
        hunkLines.push(`-${origLine}`);
        originalLine++;
      }
      if (modLine !== undefined) {
        hunkLines.push(`+${modLine}`);
        modifiedLine++;
      }
    } else if (hunkStart !== -1) {
      // Add context after (up to 3 lines)
      hunkLines.push(` ${origLine}`);
      if (hunkLines.filter(l => l.startsWith(' ')).length >= 6) {
        // Flush hunk
        diff.push(`@@ -${hunkStart + 1},${originalLine + 3} +${hunkStart + 1},${modifiedLine + 3} @@`);
        diff.push(...hunkLines);
        hunkStart = -1;
        hunkLines = [];
        originalLine = 0;
        modifiedLine = 0;
      }
    }
  }

  // Flush remaining hunk
  if (hunkStart !== -1 && hunkLines.length > 0) {
    diff.push(`@@ -${hunkStart + 1} +${hunkStart + 1} @@`);
    diff.push(...hunkLines);
  }

  return diff.join('\n');
}

/**
 * Count occurrences of a string in text
 */
function countOccurrences(text: string, search: string): number {
  if (!search) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

// ============================================================================
// Main Implementation
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
 * Apply edit operations to file content
 */
function applyOperations(
  content: string,
  operations: EditOperation[]
): { result: string; replacements: number; appliedCount: number } {
  let result = content;
  let totalReplacements = 0;
  let appliedCount = 0;

  for (const op of operations) {
    if (!op.search) continue;

    const beforeCount = countOccurrences(result, op.search);
    if (beforeCount === 0) continue;

    if (op.all) {
      // Replace all occurrences
      result = result.split(op.search).join(op.replace);
      totalReplacements += beforeCount;
    } else {
      // Replace first occurrence only
      result = result.replace(op.search, op.replace);
      totalReplacements += 1;
    }

    appliedCount++;
  }

  return { result, replacements: totalReplacements, appliedCount };
}

/**
 * Edit a file with search/replace operations
 *
 * @param options - Edit file options
 * @returns Edit result with diff
 */
export async function editFileImpl(options: EditFileOptions): Promise<EditFileResult> {
  const filePath = resolvePath(options.path, options.baseDir);
  const encoding = options.encoding ?? 'utf-8';

  // Check file exists
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read original content
  const originalContent = await readFile(filePath, { encoding });

  // Validate operations
  if (!options.operations || options.operations.length === 0) {
    throw new Error('No edit operations provided');
  }

  // Apply operations
  const { result, replacements, appliedCount } = applyOperations(
    originalContent,
    options.operations
  );

  // Check if anything changed
  if (result === originalContent) {
    return {
      path: filePath,
      operationsApplied: 0,
      totalReplacements: 0,
      diff: '# No changes made',
      yjsSynced: false,
    };
  }

  // Generate diff before writing
  const diff = generateUnifiedDiff(options.path, originalContent, result);

  // Create backup if requested
  if (options.backup) {
    const backupPath = `${filePath}.backup-${Date.now()}`;
    await writeFile(backupPath, originalContent, { encoding });
  }

  // Write modified content
  await writeFile(filePath, result, { encoding });

  // Sync to Yjs
  let yjsSynced = false;
  if (options.docId !== undefined) {
    const docId = options.docId || filePath;
    yjsRegistry.updateDoc(docId, result);
    yjsSynced = true;
  }

  return {
    path: filePath,
    operationsApplied: appliedCount,
    totalReplacements: replacements,
    diff,
    yjsSynced,
    originalContent,
  };
}

// ============================================================================
// Tool Integration
// ============================================================================

/**
 * Edit file tool for AgentToolExecutor
 *
 * Implements the ToolFunction interface with:
 * - Array of { search, replace, all } operations
 * - Unified diff output
 * - Yjs sync integration
 */
export async function editFileTool(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const operations = params.options?.operations as EditOperation[];
    if (!operations || !Array.isArray(operations)) {
      throw new Error('operations array is required for edit_file');
    }

    const options: EditFileOptions = {
      path: params.target,
      operations,
      baseDir: params.options?.baseDir as string,
      backup: params.options?.backup as boolean,
      docId: params.options?.docId as string,
      encoding: params.options?.encoding as BufferEncoding,
    };

    // Enable Yjs sync by default for real-time collaboration (matches write_file behavior)
    if (options.docId === undefined) {
      options.docId = options.path;
    }

    const result = await editFileImpl(options);

    return {
      success: true,
      data: {
        path: result.path,
        operationsApplied: result.operationsApplied,
        totalReplacements: result.totalReplacements,
        diff: result.diff,
        yjsSynced: result.yjsSynced,
      },
      duration: Date.now() - startTime,
      toolName: 'edit_file',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'edit_file',
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default editFileTool;
