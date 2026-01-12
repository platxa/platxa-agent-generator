/**
 * Tests for detectPackageManager utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectPackageManager,
  detectLockfile,
  detectFromPackageJson,
  getInstallCommand,
  getDevInstallCommand,
} from '../detectPackageManager.js';

describe('detectPackageManager', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monaco-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('detectLockfile', () => {
    it('detects pnpm-lock.yaml', () => {
      fs.writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), '');
      const result = detectLockfile(testDir);
      expect(result.type).toBe('pnpm');
      expect(result.exists).toBe(true);
    });

    it('detects package-lock.json', () => {
      fs.writeFileSync(path.join(testDir, 'package-lock.json'), '{}');
      const result = detectLockfile(testDir);
      expect(result.type).toBe('npm');
      expect(result.exists).toBe(true);
    });

    it('detects yarn.lock', () => {
      fs.writeFileSync(path.join(testDir, 'yarn.lock'), '');
      const result = detectLockfile(testDir);
      expect(result.type).toBe('yarn');
      expect(result.exists).toBe(true);
    });

    it('detects bun.lockb', () => {
      fs.writeFileSync(path.join(testDir, 'bun.lockb'), '');
      const result = detectLockfile(testDir);
      expect(result.type).toBe('bun');
      expect(result.exists).toBe(true);
    });

    it('returns npm with exists=false when no lockfile found', () => {
      const result = detectLockfile(testDir);
      expect(result.type).toBe('npm');
      expect(result.exists).toBe(false);
    });

    it('prefers pnpm over npm when both exist', () => {
      fs.writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), '');
      fs.writeFileSync(path.join(testDir, 'package-lock.json'), '{}');
      const result = detectLockfile(testDir);
      expect(result.type).toBe('pnpm');
    });
  });

  describe('detectFromPackageJson', () => {
    it('detects packageManager field with pnpm', () => {
      const packageJson = { packageManager: 'pnpm@8.0.0' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectFromPackageJson(path.join(testDir, 'package.json'));
      expect(result).toBe('pnpm');
    });

    it('detects packageManager field with yarn', () => {
      const packageJson = { packageManager: 'yarn@4.0.0' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectFromPackageJson(path.join(testDir, 'package.json'));
      expect(result).toBe('yarn');
    });

    it('returns null when no packageManager field', () => {
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectFromPackageJson(path.join(testDir, 'package.json'));
      expect(result).toBeNull();
    });

    it('returns null when file does not exist', () => {
      const result = detectFromPackageJson(path.join(testDir, 'nonexistent.json'));
      expect(result).toBeNull();
    });
  });

  describe('detectPackageManager', () => {
    it('prefers packageManager field over lockfile', () => {
      const packageJson = { packageManager: 'yarn@4.0.0' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      fs.writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), '');
      const result = detectPackageManager(testDir);
      expect(result).toBe('yarn');
    });

    it('falls back to lockfile detection', () => {
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      fs.writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), '');
      const result = detectPackageManager(testDir);
      expect(result).toBe('pnpm');
    });

    it('defaults to npm when nothing found', () => {
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectPackageManager(testDir);
      expect(result).toBe('npm');
    });
  });

  describe('getInstallCommand', () => {
    it('generates correct npm install command', () => {
      expect(getInstallCommand('npm')).toBe('npm install');
      expect(getInstallCommand('npm', ['react', 'react-dom'])).toBe(
        'npm install react react-dom'
      );
    });

    it('generates correct pnpm install command', () => {
      expect(getInstallCommand('pnpm')).toBe('pnpm install');
      expect(getInstallCommand('pnpm', ['react'])).toBe('pnpm add react');
    });

    it('generates correct yarn install command', () => {
      expect(getInstallCommand('yarn')).toBe('yarn install');
      expect(getInstallCommand('yarn', ['react'])).toBe('yarn add react');
    });

    it('generates correct bun install command', () => {
      expect(getInstallCommand('bun')).toBe('bun install');
      expect(getInstallCommand('bun', ['react'])).toBe('bun add react');
    });
  });

  describe('getDevInstallCommand', () => {
    it('generates correct npm dev install command', () => {
      expect(getDevInstallCommand('npm', ['typescript'])).toBe(
        'npm install --save-dev typescript'
      );
    });

    it('generates correct pnpm dev install command', () => {
      expect(getDevInstallCommand('pnpm', ['typescript'])).toBe(
        'pnpm add -D typescript'
      );
    });

    it('generates correct yarn dev install command', () => {
      expect(getDevInstallCommand('yarn', ['typescript'])).toBe(
        'yarn add -D typescript'
      );
    });

    it('generates correct bun dev install command', () => {
      expect(getDevInstallCommand('bun', ['typescript'])).toBe(
        'bun add -d typescript'
      );
    });
  });
});
