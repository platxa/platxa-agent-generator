/**
 * Read File Tool Tests - REAL INTEGRATION TESTS
 * Verifies Feature #18: read_file tool with optional line range support
 *
 * These are real integration tests that:
 * - Read actual files from the codebase
 * - Verify line range extraction works correctly
 * - Test error handling with real file system operations
 *
 * Verification criteria:
 * - Returns file content
 * - Optional lines parameter returns specific range
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import {
  readFileTool,
  readFileImpl,
  type ReadFileResult,
} from '@/lib/agentic-core/tools/read-file';
import type { ToolParams } from '@/lib/agentic-core/tool-executor';
import type { AgentContext } from '@/lib/agentic-core/agent-engine';

const createMockContext = (): AgentContext => ({
  filesRead: new Map(),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

const createToolParams = (target: string, options?: Record<string, unknown>): ToolParams => ({
  target,
  context: createMockContext(),
  options,
});

// Test file path (this test file itself)
const TEST_FILE = resolve(__dirname, 'read-file.test.ts');
const KNOWN_FILE = resolve(__dirname, '../../..', 'lib/agentic-core/tools/read-file.ts');

describe('Read File Tool - Real Integration Tests', () => {
  describe('readFileTool() - basic functionality', () => {
    it('should return ToolResult structure', async () => {
      const result = await readFileTool(createToolParams(TEST_FILE));

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        toolName: 'read_file',
      });
    });

    it('should read this test file successfully', async () => {
      const result = await readFileTool(createToolParams(TEST_FILE));

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const data = result.data as { path: string; content: string };
      expect(data.path).toBe(TEST_FILE);
      expect(data.content).toContain('Read File Tool Tests');
    });

    it('should include metadata in result', async () => {
      const result = await readFileTool(createToolParams(TEST_FILE));

      expect(result.success).toBe(true);
      const data = result.data as { metadata: Record<string, unknown> };

      expect(data.metadata).toMatchObject({
        totalLines: expect.any(Number),
        startLine: expect.any(Number),
        endLine: expect.any(Number),
        size: expect.any(Number),
        encoding: expect.any(String),
        truncated: expect.any(Boolean),
      });
    });

    it('should handle non-existent file gracefully', async () => {
      const result = await readFileTool(
        createToolParams('/nonexistent/path/to/file.ts')
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should report duration even on error', async () => {
      const result = await readFileTool(
        createToolParams('/nonexistent/file.ts')
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('readFileTool() - line range support', () => {
    it('should return specific line range with startLine', async () => {
      const result = await readFileTool(
        createToolParams(KNOWN_FILE, { startLine: 1, endLine: 10 })
      );

      expect(result.success).toBe(true);
      const data = result.data as { content: string; metadata: { startLine: number; endLine: number; truncated: boolean } };

      expect(data.metadata.startLine).toBe(1);
      expect(data.metadata.endLine).toBe(10);
      expect(data.metadata.truncated).toBe(true);

      // Should have exactly 10 lines
      const lineCount = data.content.split('\n').length;
      expect(lineCount).toBe(10);
    });

    it('should return lines from middle of file', async () => {
      const result = await readFileTool(
        createToolParams(KNOWN_FILE, { startLine: 20, endLine: 30 })
      );

      expect(result.success).toBe(true);
      const data = result.data as { content: string; metadata: { startLine: number; endLine: number } };

      expect(data.metadata.startLine).toBe(20);
      expect(data.metadata.endLine).toBe(30);

      // Should have 11 lines (20-30 inclusive)
      const lineCount = data.content.split('\n').length;
      expect(lineCount).toBe(11);
    });

    it('should handle startLine only (read to end)', async () => {
      const fullResult = await readFileTool(createToolParams(KNOWN_FILE));
      const totalLines = (fullResult.data as { metadata: { totalLines: number } }).metadata.totalLines;

      const result = await readFileTool(
        createToolParams(KNOWN_FILE, { startLine: totalLines - 5 })
      );

      expect(result.success).toBe(true);
      const data = result.data as { metadata: { startLine: number; endLine: number } };

      expect(data.metadata.startLine).toBe(totalLines - 5);
      expect(data.metadata.endLine).toBe(totalLines);
    });

    it('should handle endLine only (read from start)', async () => {
      const result = await readFileTool(
        createToolParams(KNOWN_FILE, { endLine: 5 })
      );

      expect(result.success).toBe(true);
      const data = result.data as { metadata: { startLine: number; endLine: number } };

      expect(data.metadata.startLine).toBe(1);
      expect(data.metadata.endLine).toBe(5);
    });

    it('should clamp line numbers to file bounds', async () => {
      const result = await readFileTool(
        createToolParams(KNOWN_FILE, { startLine: 1, endLine: 999999 })
      );

      expect(result.success).toBe(true);
      const data = result.data as { metadata: { totalLines: number; endLine: number } };

      // endLine should be clamped to totalLines
      expect(data.metadata.endLine).toBe(data.metadata.totalLines);
    });

    it('should handle startLine > endLine by setting start = end', async () => {
      const result = await readFileTool(
        createToolParams(KNOWN_FILE, { startLine: 50, endLine: 10 })
      );

      expect(result.success).toBe(true);
      const data = result.data as { metadata: { startLine: number; endLine: number } };

      expect(data.metadata.startLine).toBeLessThanOrEqual(data.metadata.endLine);
    });
  });

  describe('readFileImpl() - direct API', () => {
    it('should return ReadFileResult structure', async () => {
      const result = await readFileImpl({ path: TEST_FILE });

      expect(result).toMatchObject({
        path: expect.any(String),
        content: expect.any(String),
        totalLines: expect.any(Number),
        startLine: expect.any(Number),
        endLine: expect.any(Number),
        size: expect.any(Number),
        encoding: expect.any(String),
        truncated: expect.any(Boolean),
      });
    });

    it('should read TypeScript file with correct encoding', async () => {
      const result = await readFileImpl({ path: KNOWN_FILE });

      expect(result.encoding).toBe('utf-8');
      expect(result.content).toContain('export');
    });

    it('should report truncated=false for full file', async () => {
      const result = await readFileImpl({ path: KNOWN_FILE });

      expect(result.truncated).toBe(false);
      expect(result.startLine).toBe(1);
      expect(result.endLine).toBe(result.totalLines);
    });

    it('should report truncated=true for line range', async () => {
      const result = await readFileImpl({
        path: KNOWN_FILE,
        startLine: 1,
        endLine: 10,
      });

      expect(result.truncated).toBe(true);
    });

    it('should throw for binary files', async () => {
      // Create a path that would be detected as binary
      await expect(
        readFileImpl({ path: '/fake/image.png' })
      ).rejects.toThrow();
    });

    it('should resolve relative paths', async () => {
      const result = await readFileImpl({
        path: 'lib/agentic-core/tools/read-file.ts',
        baseDir: resolve(__dirname, '../../..'),
      });

      expect(result.path).toBe(KNOWN_FILE);
      expect(result.content).toContain('readFileImpl');
    });
  });

  describe('file content verification', () => {
    it('should preserve file content exactly', async () => {
      const result = await readFileImpl({ path: KNOWN_FILE });

      // File should contain specific expected patterns
      expect(result.content).toContain('Read File Tool');
      expect(result.content).toContain('export async function readFileImpl');
      expect(result.content).toContain('ReadFileOptions');
      expect(result.content).toContain('ReadFileResult');
    });

    it('should correctly count lines', async () => {
      const result = await readFileImpl({ path: KNOWN_FILE });

      const actualLineCount = result.content.split('\n').length;
      expect(result.totalLines).toBe(actualLineCount);
    });

    it('should read JSON files correctly', async () => {
      const packageJson = resolve(__dirname, '../../..', 'package.json');
      const result = await readFileImpl({ path: packageJson });

      expect(result.encoding).toBe('utf-8');
      expect(result.content).toContain('"name"');
      expect(() => JSON.parse(result.content)).not.toThrow();
    });
  });

  describe('context integration', () => {
    it('should update context.filesRead on successful read', async () => {
      const context = createMockContext();
      const params = createToolParams(KNOWN_FILE, {});
      params.context = context;

      const result = await readFileTool(params);

      expect(result.success).toBe(true);
      expect(context.filesRead.has(KNOWN_FILE)).toBe(true);
      expect(context.filesRead.get(KNOWN_FILE)).toContain('readFileImpl');
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // /etc/shadow is typically not readable
      const result = await readFileTool(createToolParams('/etc/shadow'));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle directory path (not a file)', async () => {
      const result = await readFileTool(
        createToolParams(resolve(__dirname, '../../..'))
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a file');
    });

    it('should reject files exceeding maxSize', async () => {
      const result = await readFileTool(
        createToolParams(KNOWN_FILE, { maxSize: 100 }) // 100 bytes max
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });
  });
});
