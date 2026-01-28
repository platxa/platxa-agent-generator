/**
 * Read File Tool - Production-grade file reading with line range support
 *
 * Features:
 * - Full file reading with encoding detection
 * - Optional line range support (startLine, endLine)
 * - File metadata (size, encoding, line count)
 * - Binary file detection and rejection
 * - Proper error handling for missing/inaccessible files
 *
 * @module agentic-core/tools/read-file
 */

import { readFile as fsReadFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, resolve, isAbsolute } from 'path';
import type { ToolParams, ToolResult } from '../tool-executor';

// ============================================================================
// Types
// ============================================================================

/** Options for reading files */
export interface ReadFileOptions {
  /** File path to read */
  path: string;
  /** Starting line number (1-based, inclusive) */
  startLine?: number;
  /** Ending line number (1-based, inclusive) */
  endLine?: number;
  /** Base directory for relative paths */
  baseDir?: string;
  /** Maximum file size to read in bytes (default: 10MB) */
  maxSize?: number;
  /** Encoding to use (default: utf-8) */
  encoding?: BufferEncoding;
}

/** Result from reading a file */
export interface ReadFileResult {
  /** File path that was read */
  path: string;
  /** File content (full or range) */
  content: string;
  /** Total number of lines in file */
  totalLines: number;
  /** Starting line of returned content (1-based) */
  startLine: number;
  /** Ending line of returned content (1-based) */
  endLine: number;
  /** File size in bytes */
  size: number;
  /** Encoding used */
  encoding: string;
  /** Whether content was truncated due to line range */
  truncated: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum file size (10MB) */
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/** File extensions considered binary (skip reading) */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pyc', '.pyo', '.class', '.o', '.obj',
]);

/** File extensions that should use specific encodings */
const ENCODING_MAP: Record<string, BufferEncoding> = {
  '.json': 'utf-8',
  '.xml': 'utf-8',
  '.html': 'utf-8',
  '.css': 'utf-8',
  '.js': 'utf-8',
  '.ts': 'utf-8',
  '.tsx': 'utf-8',
  '.jsx': 'utf-8',
  '.py': 'utf-8',
  '.md': 'utf-8',
  '.txt': 'utf-8',
  '.yaml': 'utf-8',
  '.yml': 'utf-8',
  '.scss': 'utf-8',
  '.less': 'utf-8',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a file extension indicates a binary file
 */
function isBinaryFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Get appropriate encoding for file type
 */
function getEncoding(filePath: string, requestedEncoding?: BufferEncoding): BufferEncoding {
  if (requestedEncoding) return requestedEncoding;

  const ext = extname(filePath).toLowerCase();
  return ENCODING_MAP[ext] || 'utf-8';
}

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
 * Extract lines from content based on range
 */
function extractLineRange(
  content: string,
  startLine?: number,
  endLine?: number
): { lines: string[]; actualStart: number; actualEnd: number } {
  const allLines = content.split('\n');
  const totalLines = allLines.length;

  // Default to full file
  let actualStart = 1;
  let actualEnd = totalLines;

  // Apply start line constraint
  if (startLine !== undefined && startLine > 0) {
    actualStart = Math.min(startLine, totalLines);
  }

  // Apply end line constraint
  if (endLine !== undefined && endLine > 0) {
    actualEnd = Math.min(endLine, totalLines);
  }

  // Ensure start <= end
  if (actualStart > actualEnd) {
    actualStart = actualEnd;
  }

  // Extract lines (convert from 1-based to 0-based indexing)
  const lines = allLines.slice(actualStart - 1, actualEnd);

  return { lines, actualStart, actualEnd };
}

// ============================================================================
// Main Implementation
// ============================================================================

/**
 * Read a file with optional line range support
 *
 * @param options - Read file options
 * @returns File content and metadata
 * @throws Error if file doesn't exist, is too large, or is binary
 */
export async function readFileImpl(options: ReadFileOptions): Promise<ReadFileResult> {
  const filePath = resolvePath(options.path, options.baseDir);
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const encoding = getEncoding(filePath, options.encoding);

  // Check file exists
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Check for binary files
  if (isBinaryFile(filePath)) {
    throw new Error(`Cannot read binary file: ${filePath}`);
  }

  // Get file stats
  const stats = await stat(filePath);

  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }

  // Check file size
  if (stats.size > maxSize) {
    throw new Error(
      `File too large: ${filePath} (${stats.size} bytes, max: ${maxSize} bytes)`
    );
  }

  // Read file content
  const content = await fsReadFile(filePath, { encoding });

  // Extract line range if specified
  const { lines, actualStart, actualEnd } = extractLineRange(
    content,
    options.startLine,
    options.endLine
  );

  const totalLines = content.split('\n').length;
  const truncated = actualStart > 1 || actualEnd < totalLines;

  return {
    path: filePath,
    content: lines.join('\n'),
    totalLines,
    startLine: actualStart,
    endLine: actualEnd,
    size: stats.size,
    encoding,
    truncated,
  };
}

// ============================================================================
// Tool Integration
// ============================================================================

/**
 * Read file tool for AgentToolExecutor
 *
 * Implements the ToolFunction interface with:
 * - Full file reading with proper encoding
 * - Optional line range support (startLine, endLine in options)
 * - File metadata in result
 * - Production-grade error handling
 */
export async function readFileTool(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const options: ReadFileOptions = {
      path: params.target,
      baseDir: params.options?.baseDir as string,
      startLine: params.options?.startLine as number,
      endLine: params.options?.endLine as number,
      maxSize: params.options?.maxSize as number,
      encoding: params.options?.encoding as BufferEncoding,
    };

    const result = await readFileImpl(options);

    // Update context with file content for caching
    if (params.context?.filesRead) {
      params.context.filesRead.set(result.path, result.content);
    }

    return {
      success: true,
      data: {
        path: result.path,
        content: result.content,
        metadata: {
          totalLines: result.totalLines,
          startLine: result.startLine,
          endLine: result.endLine,
          size: result.size,
          encoding: result.encoding,
          truncated: result.truncated,
        },
      },
      duration: Date.now() - startTime,
      toolName: 'read_file',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'read_file',
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default readFileTool;
