/**
 * Tests for detectReactVersion utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectReactVersion,
  detectTypescriptVersion,
  hasTypeScript,
  analyzeReactCompatibility,
  parseVersion,
  compareVersions,
} from '../detectReactVersion.js';

describe('detectReactVersion', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monaco-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('parseVersion', () => {
    it('parses standard semver', () => {
      const result = parseVersion('18.2.0');
      expect(result).toEqual({
        raw: '18.2.0',
        major: 18,
        minor: 2,
        patch: 0,
      });
    });

    it('parses caret version', () => {
      const result = parseVersion('^18.2.0');
      expect(result).toEqual({
        raw: '^18.2.0',
        major: 18,
        minor: 2,
        patch: 0,
      });
    });

    it('parses tilde version', () => {
      const result = parseVersion('~17.0.2');
      expect(result).toEqual({
        raw: '~17.0.2',
        major: 17,
        minor: 0,
        patch: 2,
      });
    });

    it('returns null for invalid version', () => {
      expect(parseVersion('latest')).toBeNull();
      expect(parseVersion('*')).toBeNull();
      expect(parseVersion('')).toBeNull();
    });
  });

  describe('compareVersions', () => {
    it('compares major versions', () => {
      const v18 = { raw: '18.0.0', major: 18, minor: 0, patch: 0 };
      const v17 = { raw: '17.0.0', major: 17, minor: 0, patch: 0 };
      expect(compareVersions(v18, v17)).toBe(1);
      expect(compareVersions(v17, v18)).toBe(-1);
    });

    it('compares minor versions', () => {
      const v18_2 = { raw: '18.2.0', major: 18, minor: 2, patch: 0 };
      const v18_1 = { raw: '18.1.0', major: 18, minor: 1, patch: 0 };
      expect(compareVersions(v18_2, v18_1)).toBe(1);
      expect(compareVersions(v18_1, v18_2)).toBe(-1);
    });

    it('compares patch versions', () => {
      const v18_2_1 = { raw: '18.2.1', major: 18, minor: 2, patch: 1 };
      const v18_2_0 = { raw: '18.2.0', major: 18, minor: 2, patch: 0 };
      expect(compareVersions(v18_2_1, v18_2_0)).toBe(1);
      expect(compareVersions(v18_2_0, v18_2_1)).toBe(-1);
    });

    it('returns 0 for equal versions', () => {
      const v1 = { raw: '18.2.0', major: 18, minor: 2, patch: 0 };
      const v2 = { raw: '18.2.0', major: 18, minor: 2, patch: 0 };
      expect(compareVersions(v1, v2)).toBe(0);
    });
  });

  describe('detectReactVersion', () => {
    it('detects React version from dependencies', () => {
      const packageJson = {
        dependencies: { react: '^18.2.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectReactVersion(testDir);
      expect(result).toBe('^18.2.0');
    });

    it('detects React version from devDependencies', () => {
      const packageJson = {
        devDependencies: { react: '17.0.2' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectReactVersion(testDir);
      expect(result).toBe('17.0.2');
    });

    it('returns null when React not found', () => {
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectReactVersion(testDir);
      expect(result).toBeNull();
    });
  });

  describe('detectTypescriptVersion', () => {
    it('detects TypeScript version', () => {
      const packageJson = {
        devDependencies: { typescript: '^5.3.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectTypescriptVersion(testDir);
      expect(result).toBe('^5.3.0');
    });

    it('returns null when TypeScript not found', () => {
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectTypescriptVersion(testDir);
      expect(result).toBeNull();
    });
  });

  describe('hasTypeScript', () => {
    it('returns true when tsconfig.json exists', () => {
      fs.writeFileSync(path.join(testDir, 'tsconfig.json'), '{}');
      const result = hasTypeScript(testDir);
      expect(result).toBe(true);
    });

    it('returns true when typescript dependency exists', () => {
      const packageJson = {
        devDependencies: { typescript: '^5.0.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = hasTypeScript(testDir);
      expect(result).toBe(true);
    });

    it('returns false when no TypeScript', () => {
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = hasTypeScript(testDir);
      expect(result).toBe(false);
    });
  });

  describe('analyzeReactCompatibility', () => {
    it('reports React 18 as fully compatible', () => {
      const packageJson = {
        dependencies: { react: '18.2.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = analyzeReactCompatibility(testDir);
      expect(result.isCompatible).toBe(true);
      expect(result.hasConcurrentFeatures).toBe(true);
      expect(result.hasHooks).toBe(true);
    });

    it('reports React 17 as compatible without concurrent features', () => {
      const packageJson = {
        dependencies: { react: '17.0.2' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = analyzeReactCompatibility(testDir);
      expect(result.isCompatible).toBe(true);
      expect(result.hasConcurrentFeatures).toBe(false);
      expect(result.hasHooks).toBe(true);
    });

    it('reports React 16.8 as compatible with hooks', () => {
      const packageJson = {
        dependencies: { react: '16.8.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = analyzeReactCompatibility(testDir);
      expect(result.isCompatible).toBe(false); // Below 17.0.0 minimum
      expect(result.hasHooks).toBe(true);
    });

    it('reports React 16.7 as incompatible', () => {
      const packageJson = {
        dependencies: { react: '16.7.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = analyzeReactCompatibility(testDir);
      expect(result.isCompatible).toBe(false);
      expect(result.hasHooks).toBe(false);
    });

    it('handles missing React', () => {
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = analyzeReactCompatibility(testDir);
      expect(result.isCompatible).toBe(false);
      expect(result.version).toBeNull();
    });
  });
});
