/**
 * Write File Tool Tests - REAL INTEGRATION TESTS
 * Verifies Feature #19: write_file tool with automatic Yjs document sync
 *
 * These are real integration tests that:
 * - Write actual files to the filesystem
 * - Verify Yjs Y.Doc sync for real-time collaboration
 * - Test that connected editors receive changes within 100ms
 *
 * Verification criteria:
 * - Write triggers Y.Doc update
 * - Connected editors receive change within 100ms
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { existsSync, unlinkSync, mkdirSync, rmdirSync, readFileSync } from 'fs';
import * as Y from 'yjs';
import {
  writeFileTool,
  writeFileImpl,
  yjsRegistry,
  type WriteFileResult,
} from '@/lib/agentic-core/tools/write-file';
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
const TEST_FILE = resolve(TEST_DIR, 'test-write.txt');

describe('Write File Tool - Real Integration Tests', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    // Clear Yjs registry
    yjsRegistry.clear();
  });

  afterEach(() => {
    // Cleanup test files
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
    // Clean up any backup files
    const backupPattern = `${TEST_FILE}.backup-`;
    try {
      const files = require('fs').readdirSync(TEST_DIR);
      for (const file of files) {
        if (file.startsWith('test-write.txt')) {
          unlinkSync(resolve(TEST_DIR, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('writeFileTool() - basic functionality', () => {
    it('should return ToolResult structure', async () => {
      const result = await writeFileTool(
        createToolParams(TEST_FILE, { content: 'test content' })
      );

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        toolName: 'write_file',
      });
    });

    it('should write file successfully', async () => {
      const content = 'Hello, World!';
      const result = await writeFileTool(
        createToolParams(TEST_FILE, { content })
      );

      expect(result.success).toBe(true);
      expect(existsSync(TEST_FILE)).toBe(true);

      const written = readFileSync(TEST_FILE, 'utf-8');
      expect(written).toBe(content);
    });

    it('should return bytesWritten in result', async () => {
      const content = 'Test content with bytes';
      const result = await writeFileTool(
        createToolParams(TEST_FILE, { content })
      );

      expect(result.success).toBe(true);
      const data = result.data as { bytesWritten: number };
      expect(data.bytesWritten).toBe(Buffer.byteLength(content, 'utf-8'));
    });

    it('should fail without content', async () => {
      const result = await writeFileTool(createToolParams(TEST_FILE));

      expect(result.success).toBe(false);
      expect(result.error).toContain('content is required');
    });

    it('should report duration', async () => {
      const result = await writeFileTool(
        createToolParams(TEST_FILE, { content: 'test' })
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('writeFileTool() - Yjs document sync', () => {
    it('should sync to Yjs Y.Doc on write', async () => {
      const content = 'Yjs synced content';
      const docId = 'test-doc-1';

      const result = await writeFileTool(
        createToolParams(TEST_FILE, { content, docId })
      );

      expect(result.success).toBe(true);
      const data = result.data as { yjsSynced: boolean };
      expect(data.yjsSynced).toBe(true);

      // Verify Y.Doc has the content
      const yContent = yjsRegistry.getContent(docId);
      expect(yContent).toBe(content);
    });

    it('should complete Yjs sync within 100ms', async () => {
      const content = 'Performance test content - '.repeat(100); // ~2.5KB
      const docId = 'test-perf-doc';

      const result = await writeFileTool(
        createToolParams(TEST_FILE, { content, docId })
      );

      expect(result.success).toBe(true);
      const data = result.data as { yjsSyncTime: number };
      expect(data.yjsSyncTime).toBeLessThan(100); // Must be under 100ms
    });

    it('should notify connected editors of updates', async () => {
      const content = 'Broadcast test content';
      const docId = 'test-broadcast-doc';
      let receivedUpdate: Uint8Array | null = null;
      let updateReceivedTime = 0;

      // Subscribe to updates (simulating connected editor)
      const unsubscribe = yjsRegistry.subscribe(docId, (update) => {
        receivedUpdate = update;
        updateReceivedTime = performance.now();
      });

      const startTime = performance.now();
      const result = await writeFileTool(
        createToolParams(TEST_FILE, { content, docId })
      );

      expect(result.success).toBe(true);
      expect(receivedUpdate).not.toBeNull();

      // Verify update was received within 100ms
      const latency = updateReceivedTime - startTime;
      expect(latency).toBeLessThan(100);

      unsubscribe();
    });

    it('should use file path as default docId', async () => {
      const content = 'Default docId test';

      const result = await writeFileTool(
        createToolParams(TEST_FILE, { content })
      );

      expect(result.success).toBe(true);

      // Should have created Y.Doc with file path as ID
      expect(yjsRegistry.hasDoc(TEST_FILE)).toBe(true);
      expect(yjsRegistry.getContent(TEST_FILE)).toBe(content);
    });

    it('should allow multiple editors to receive same update', async () => {
      const content = 'Multi-editor test';
      const docId = 'test-multi-editor';
      const receivedUpdates: Uint8Array[] = [];

      // Simulate 3 connected editors
      const unsubscribe1 = yjsRegistry.subscribe(docId, (u) => receivedUpdates.push(u));
      const unsubscribe2 = yjsRegistry.subscribe(docId, (u) => receivedUpdates.push(u));
      const unsubscribe3 = yjsRegistry.subscribe(docId, (u) => receivedUpdates.push(u));

      await writeFileTool(createToolParams(TEST_FILE, { content, docId }));

      // All 3 editors should receive the update
      expect(receivedUpdates.length).toBe(3);

      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    });
  });

  describe('writeFileImpl() - direct API', () => {
    it('should return WriteFileResult structure', async () => {
      const result = await writeFileImpl({
        path: TEST_FILE,
        content: 'Direct API test',
      });

      expect(result).toMatchObject({
        path: expect.any(String),
        bytesWritten: expect.any(Number),
        dirsCreated: expect.any(Boolean),
        yjsSynced: expect.any(Boolean),
      });
    });

    it('should create parent directories', async () => {
      const nestedFile = resolve(TEST_DIR, 'nested/deep/file.txt');

      const result = await writeFileImpl({
        path: nestedFile,
        content: 'Nested content',
        createDirs: true,
      });

      expect(result.dirsCreated).toBe(true);
      expect(existsSync(nestedFile)).toBe(true);

      // Cleanup
      unlinkSync(nestedFile);
      rmdirSync(resolve(TEST_DIR, 'nested/deep'));
      rmdirSync(resolve(TEST_DIR, 'nested'));
    });

    it('should create backup when enabled', async () => {
      // Write initial file
      await writeFileImpl({ path: TEST_FILE, content: 'Original' });

      // Overwrite with backup
      const result = await writeFileImpl({
        path: TEST_FILE,
        content: 'Updated',
        backup: true,
      });

      expect(result.backupPath).toBeDefined();
      expect(existsSync(result.backupPath!)).toBe(true);
      expect(readFileSync(result.backupPath!, 'utf-8')).toBe('Original');
      expect(readFileSync(TEST_FILE, 'utf-8')).toBe('Updated');

      // Cleanup backup
      unlinkSync(result.backupPath!);
    });

    it('should support custom encoding', async () => {
      const content = 'UTF-16 content: 你好';

      const result = await writeFileImpl({
        path: TEST_FILE,
        content,
        encoding: 'utf-8',
      });

      expect(result.bytesWritten).toBeGreaterThan(content.length); // UTF-8 multi-byte
    });
  });

  describe('Yjs Registry', () => {
    it('should manage multiple documents', () => {
      yjsRegistry.updateDoc('doc1', 'Content 1');
      yjsRegistry.updateDoc('doc2', 'Content 2');
      yjsRegistry.updateDoc('doc3', 'Content 3');

      expect(yjsRegistry.getDocIds()).toHaveLength(3);
      expect(yjsRegistry.getContent('doc1')).toBe('Content 1');
      expect(yjsRegistry.getContent('doc2')).toBe('Content 2');
      expect(yjsRegistry.getContent('doc3')).toBe('Content 3');
    });

    it('should remove documents', () => {
      yjsRegistry.updateDoc('temp-doc', 'Temporary');
      expect(yjsRegistry.hasDoc('temp-doc')).toBe(true);

      yjsRegistry.removeDoc('temp-doc');
      expect(yjsRegistry.hasDoc('temp-doc')).toBe(false);
    });

    it('should return empty string for non-existent doc', () => {
      expect(yjsRegistry.getContent('non-existent')).toBe('');
    });

    it('should update existing document content', () => {
      yjsRegistry.updateDoc('update-test', 'Initial');
      expect(yjsRegistry.getContent('update-test')).toBe('Initial');

      yjsRegistry.updateDoc('update-test', 'Updated');
      expect(yjsRegistry.getContent('update-test')).toBe('Updated');
    });
  });

  describe('error handling', () => {
    it('should fail for invalid directory without createDirs', async () => {
      const result = await writeFileTool(
        createToolParams('/nonexistent/path/file.txt', {
          content: 'test',
          createDirs: false,
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should report duration even on error', async () => {
      const result = await writeFileTool(
        createToolParams('/invalid/path', { content: 'test', createDirs: false })
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('tool-executor integration', () => {
    it('should work through AgentToolExecutor', async () => {
      const { AgentToolExecutor } = await import('@/lib/agentic-core/tool-executor');
      const executor = new AgentToolExecutor();

      const result = await executor.execute('write', {
        target: TEST_FILE,
        context: createMockContext(),
        content: 'Executor test content',
      });

      expect(result).toBeDefined();
      expect(existsSync(TEST_FILE)).toBe(true);
    });
  });
});
