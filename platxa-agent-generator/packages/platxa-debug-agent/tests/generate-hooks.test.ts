/**
 * Tests for generate-hooks command
 *
 * Verifies hook generation creates proper .claude/hooks/ structure
 * with pre-commit and post-error hooks that call debug-agent.
 */

import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generateHooksCommand,
  checkHooksInstalled,
  removeHooks,
} from '../src/cli/commands/generate-hooks.js';

describe('generate-hooks command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `hooks-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('generateHooksCommand', () => {
    it('should create hooks directory structure', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
        verbose: false,
      });

      expect(existsSync(targetDir)).toBe(true);
    });

    it('should generate pre-commit hook', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
        hooks: ['pre-commit'],
      });

      const hookPath = join(targetDir, 'pre-commit.sh');
      expect(existsSync(hookPath)).toBe(true);

      const content = readFileSync(hookPath, 'utf-8');
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('Pre-Commit Hook');
      expect(content).toContain('platxa-debug');
    });

    it('should generate post-error hook', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
        hooks: ['post-error'],
      });

      const hookPath = join(targetDir, 'post-error.sh');
      expect(existsSync(hookPath)).toBe(true);

      const content = readFileSync(hookPath, 'utf-8');
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('Post-Error Hook');
      expect(content).toContain('platxa-debug analyze');
    });

    it('should generate both hooks by default', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
      });

      expect(existsSync(join(targetDir, 'pre-commit.sh'))).toBe(true);
      expect(existsSync(join(targetDir, 'post-error.sh'))).toBe(true);
    });

    it('should not overwrite existing hooks without --force', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      // Generate hooks first time
      await generateHooksCommand({
        target: targetDir,
        hooks: ['pre-commit'],
      });

      const hookPath = join(targetDir, 'pre-commit.sh');
      const originalContent = readFileSync(hookPath, 'utf-8');

      // Try to generate again without force
      await generateHooksCommand({
        target: targetDir,
        hooks: ['pre-commit'],
      });

      // Content should be unchanged
      const newContent = readFileSync(hookPath, 'utf-8');
      expect(newContent).toBe(originalContent);
    });

    it('should overwrite existing hooks with --force', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      // Generate hooks first time
      await generateHooksCommand({
        target: targetDir,
        hooks: ['pre-commit'],
      });

      const hookPath = join(targetDir, 'pre-commit.sh');
      expect(existsSync(hookPath)).toBe(true);

      // Generate again with force - should succeed without error
      await generateHooksCommand({
        target: targetDir,
        hooks: ['pre-commit'],
        force: true,
      });

      // Hook should still exist
      expect(existsSync(hookPath)).toBe(true);
    });

    it('should create settings.json with hook configuration', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
      });

      const settingsPath = join(tempDir, '.claude', 'settings.json');
      expect(existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.enabled).toBe(true);
      expect(settings.hooks.preCommit).toBe(true);
      expect(settings.hooks.postError).toBe(true);
    });

    it('should generate pre-tool-use hook when requested', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
        hooks: ['pre-tool-use'],
      });

      const hookPath = join(targetDir, 'pre-tool-use.sh');
      expect(existsSync(hookPath)).toBe(true);

      const content = readFileSync(hookPath, 'utf-8');
      expect(content).toContain('Pre-Tool-Use Hook');
      expect(content).toContain('CLAUDE_TOOL_NAME');
    });

    it('should generate post-tool-use hook when requested', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
        hooks: ['post-tool-use'],
      });

      const hookPath = join(targetDir, 'post-tool-use.sh');
      expect(existsSync(hookPath)).toBe(true);

      const content = readFileSync(hookPath, 'utf-8');
      expect(content).toContain('Post-Tool-Use Hook');
      expect(content).toContain('CLAUDE_TOOL_RESULT');
    });
  });

  describe('checkHooksInstalled', () => {
    it('should return false when no hooks installed', () => {
      const targetDir = join(tempDir, '.claude', 'hooks');
      mkdirSync(targetDir, { recursive: true });

      const result = checkHooksInstalled(targetDir);

      expect(result.installed).toBe(false);
      expect(result.hooks).toHaveLength(0);
    });

    it('should detect installed hooks', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
      });

      const result = checkHooksInstalled(targetDir);

      expect(result.installed).toBe(true);
      expect(result.hooks).toContain('pre-commit');
      expect(result.hooks).toContain('post-error');
    });
  });

  describe('removeHooks', () => {
    it('should remove installed hooks', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
      });

      expect(existsSync(join(targetDir, 'pre-commit.sh'))).toBe(true);
      expect(existsSync(join(targetDir, 'post-error.sh'))).toBe(true);

      removeHooks(targetDir);

      expect(existsSync(join(targetDir, 'pre-commit.sh'))).toBe(false);
      expect(existsSync(join(targetDir, 'post-error.sh'))).toBe(false);
    });

    it('should not throw when hooks do not exist', () => {
      const targetDir = join(tempDir, '.claude', 'hooks');
      mkdirSync(targetDir, { recursive: true });

      expect(() => removeHooks(targetDir)).not.toThrow();
    });
  });

  describe('hook content', () => {
    it('pre-commit hook should check TypeScript files', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
        hooks: ['pre-commit'],
      });

      const content = readFileSync(join(targetDir, 'pre-commit.sh'), 'utf-8');

      expect(content).toContain('TypeScript');
      expect(content).toContain('tsc');
      expect(content).toContain('type check');
    });

    it('pre-commit hook should check Python files', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
        hooks: ['pre-commit'],
      });

      const content = readFileSync(join(targetDir, 'pre-commit.sh'), 'utf-8');

      expect(content).toContain('Python');
      expect(content).toContain('pyright');
    });

    it('post-error hook should use CLAUDE_ERROR_MESSAGE', async () => {
      const targetDir = join(tempDir, '.claude', 'hooks');

      await generateHooksCommand({
        target: targetDir,
        hooks: ['post-error'],
      });

      const content = readFileSync(join(targetDir, 'post-error.sh'), 'utf-8');

      expect(content).toContain('CLAUDE_ERROR_MESSAGE');
      expect(content).toContain('platxa-debug analyze');
      expect(content).toContain('platxa-debug rca');
    });
  });
});
