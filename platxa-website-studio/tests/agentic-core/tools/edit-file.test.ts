/**
 * Edit File Tool Tests - REAL INTEGRATION TESTS
 * Verifies Feature #20: edit_file tool with search/replace operations
 *
 * These are real integration tests that:
 * - Apply actual search/replace operations to files
 * - Verify diff output format
 * - Test multiple operations in sequence
 *
 * Verification criteria:
 * - Applies array of { search, replace, all } operations
 * - Returns diff showing changes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { existsSync, unlinkSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import {
  editFileTool,
  editFileImpl,
  type EditFileResult,
  type EditOperation,
} from '@/lib/agentic-core/tools/edit-file';
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

// Test directory for file operations
const TEST_DIR = resolve(__dirname, '../../../.test-output');
const TEST_FILE = resolve(TEST_DIR, 'test-edit.txt');

describe('Edit File Tool - Real Integration Tests', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    // Create test file with known content
    writeFileSync(TEST_FILE, 'Hello World\nThis is a test file\nHello again\n', 'utf-8');
  });

  afterEach(() => {
    // Cleanup test files
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
    // Clean up any backup files
    try {
      const files = require('fs').readdirSync(TEST_DIR);
      for (const file of files) {
        if (file.startsWith('test-edit')) {
          unlinkSync(resolve(TEST_DIR, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('editFileTool() - basic functionality', () => {
    it('should return ToolResult structure', async () => {
      const result = await editFileTool(
        createToolParams(TEST_FILE, {
          operations: [{ search: 'Hello', replace: 'Hi' }],
        })
      );

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        toolName: 'edit_file',
      });
    });

    it('should apply single search/replace operation', async () => {
      const result = await editFileTool(
        createToolParams(TEST_FILE, {
          operations: [{ search: 'World', replace: 'Universe' }],
        })
      );

      expect(result.success).toBe(true);
      const content = readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('Hello Universe');
      expect(content).not.toContain('Hello World');
    });

    it('should return diff in result', async () => {
      const result = await editFileTool(
        createToolParams(TEST_FILE, {
          operations: [{ search: 'Hello', replace: 'Hi' }],
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { diff: string };
      expect(data.diff).toContain('---');
      expect(data.diff).toContain('+++');
    });

    it('should fail without operations', async () => {
      const result = await editFileTool(createToolParams(TEST_FILE));

      expect(result.success).toBe(false);
      expect(result.error).toContain('operations');
    });

    it('should fail for non-existent file', async () => {
      const result = await editFileTool(
        createToolParams('/nonexistent/file.txt', {
          operations: [{ search: 'a', replace: 'b' }],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('editFileTool() - multiple operations', () => {
    it('should apply array of operations in sequence', async () => {
      const operations: EditOperation[] = [
        { search: 'Hello', replace: 'Hi' },
        { search: 'World', replace: 'Universe' },
        { search: 'test', replace: 'example' },
      ];

      const result = await editFileTool(
        createToolParams(TEST_FILE, { operations })
      );

      expect(result.success).toBe(true);
      const data = result.data as { operationsApplied: number };
      expect(data.operationsApplied).toBe(3);

      const content = readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('Hi');
      expect(content).toContain('Universe');
      expect(content).toContain('example');
    });

    it('should count total replacements correctly', async () => {
      // File has "Hello" twice
      const result = await editFileTool(
        createToolParams(TEST_FILE, {
          operations: [{ search: 'Hello', replace: 'Hi', all: true }],
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { totalReplacements: number };
      expect(data.totalReplacements).toBe(2); // "Hello" appears twice
    });

    it('should replace first occurrence only by default', async () => {
      const result = await editFileTool(
        createToolParams(TEST_FILE, {
          operations: [{ search: 'Hello', replace: 'Hi' }], // no all: true
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { totalReplacements: number };
      expect(data.totalReplacements).toBe(1);

      const content = readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('Hi World');
      expect(content).toContain('Hello again'); // Second Hello unchanged
    });

    it('should replace all occurrences when all=true', async () => {
      const result = await editFileTool(
        createToolParams(TEST_FILE, {
          operations: [{ search: 'Hello', replace: 'Hi', all: true }],
        })
      );

      expect(result.success).toBe(true);
      const content = readFileSync(TEST_FILE, 'utf-8');
      expect(content).not.toContain('Hello');
      expect(content).toContain('Hi World');
      expect(content).toContain('Hi again');
    });
  });

  describe('editFileImpl() - direct API', () => {
    it('should return EditFileResult structure', async () => {
      const result = await editFileImpl({
        path: TEST_FILE,
        operations: [{ search: 'Hello', replace: 'Hi' }],
      });

      expect(result).toMatchObject({
        path: expect.any(String),
        operationsApplied: expect.any(Number),
        totalReplacements: expect.any(Number),
        diff: expect.any(String),
        yjsSynced: expect.any(Boolean),
      });
    });

    it('should return no changes when search not found', async () => {
      const result = await editFileImpl({
        path: TEST_FILE,
        operations: [{ search: 'NOTFOUND', replace: 'x' }],
      });

      expect(result.operationsApplied).toBe(0);
      expect(result.totalReplacements).toBe(0);
      expect(result.diff).toContain('No changes');
    });

    it('should preserve original content in result', async () => {
      const result = await editFileImpl({
        path: TEST_FILE,
        operations: [{ search: 'Hello', replace: 'Hi' }],
      });

      expect(result.originalContent).toBeDefined();
      expect(result.originalContent).toContain('Hello World');
    });
  });

  describe('diff output format', () => {
    it('should include file paths in diff header', async () => {
      const result = await editFileImpl({
        path: TEST_FILE,
        operations: [{ search: 'Hello', replace: 'Hi' }],
      });

      expect(result.diff).toContain('--- a/');
      expect(result.diff).toContain('+++ b/');
    });

    it('should show removed lines with minus', async () => {
      const result = await editFileImpl({
        path: TEST_FILE,
        operations: [{ search: 'Hello World', replace: 'Hi Universe' }],
      });

      expect(result.diff).toContain('-Hello World');
    });

    it('should show added lines with plus', async () => {
      const result = await editFileImpl({
        path: TEST_FILE,
        operations: [{ search: 'Hello World', replace: 'Hi Universe' }],
      });

      expect(result.diff).toContain('+Hi Universe');
    });
  });

  describe('error handling', () => {
    it('should throw for empty operations array', async () => {
      await expect(
        editFileImpl({ path: TEST_FILE, operations: [] })
      ).rejects.toThrow('No edit operations');
    });

    it('should skip operations with empty search', async () => {
      const result = await editFileImpl({
        path: TEST_FILE,
        operations: [
          { search: '', replace: 'x' },
          { search: 'Hello', replace: 'Hi' },
        ],
      });

      expect(result.operationsApplied).toBe(1);
    });

    it('should report duration even on error', async () => {
      const result = await editFileTool(
        createToolParams('/invalid/path', {
          operations: [{ search: 'a', replace: 'b' }],
        })
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('tool-executor integration', () => {
    it('should work through AgentToolExecutor', async () => {
      const { AgentToolExecutor } = await import('@/lib/agentic-core/tool-executor');
      const executor = new AgentToolExecutor();

      const result = await executor.execute('edit', {
        target: TEST_FILE,
        context: createMockContext(),
        operations: [{ search: 'Hello', replace: 'Greetings' }],
      });

      expect(result).toBeDefined();
      const content = readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('Greetings');
    });
  });
});
