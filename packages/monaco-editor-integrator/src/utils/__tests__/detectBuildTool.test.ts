/**
 * Tests for detectBuildTool utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectBuildTool,
  detectProjectType,
  isAppRouter,
  isPagesRouter,
  getSourceDir,
} from '../detectBuildTool.js';

describe('detectBuildTool', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monaco-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('detectBuildTool', () => {
    it('detects Next.js from next.config.js', () => {
      fs.writeFileSync(path.join(testDir, 'next.config.js'), 'module.exports = {}');
      const result = detectBuildTool(testDir);
      expect(result).toBe('nextjs');
    });

    it('detects Next.js from next.config.mjs', () => {
      fs.writeFileSync(path.join(testDir, 'next.config.mjs'), 'export default {}');
      const result = detectBuildTool(testDir);
      expect(result).toBe('nextjs');
    });

    it('detects Vite from vite.config.ts', () => {
      fs.writeFileSync(path.join(testDir, 'vite.config.ts'), 'export default {}');
      const result = detectBuildTool(testDir);
      expect(result).toBe('vite');
    });

    it('detects Vite from vite.config.js', () => {
      fs.writeFileSync(path.join(testDir, 'vite.config.js'), 'export default {}');
      const result = detectBuildTool(testDir);
      expect(result).toBe('vite');
    });

    it('detects webpack from webpack.config.js', () => {
      fs.writeFileSync(path.join(testDir, 'webpack.config.js'), 'module.exports = {}');
      const result = detectBuildTool(testDir);
      expect(result).toBe('webpack');
    });

    it('detects CRA from react-scripts dependency', () => {
      const packageJson = {
        dependencies: { 'react-scripts': '5.0.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectBuildTool(testDir);
      expect(result).toBe('cra');
    });

    it('detects Next.js from next dependency when no config', () => {
      const packageJson = {
        dependencies: { next: '14.0.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectBuildTool(testDir);
      expect(result).toBe('nextjs');
    });

    it('returns unknown when no build tool detected', () => {
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectBuildTool(testDir);
      expect(result).toBe('unknown');
    });

    it('prefers config file over package.json dependency', () => {
      fs.writeFileSync(path.join(testDir, 'vite.config.ts'), 'export default {}');
      const packageJson = {
        dependencies: { next: '14.0.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectBuildTool(testDir);
      expect(result).toBe('vite');
    });
  });

  describe('detectProjectType', () => {
    it('returns nextjs for Next.js projects', () => {
      fs.writeFileSync(path.join(testDir, 'next.config.js'), 'module.exports = {}');
      const result = detectProjectType(testDir);
      expect(result).toBe('nextjs');
    });

    it('returns vite-react for Vite + React projects', () => {
      fs.writeFileSync(path.join(testDir, 'vite.config.ts'), 'export default {}');
      const packageJson = {
        dependencies: { react: '18.0.0', 'react-dom': '18.0.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectProjectType(testDir);
      expect(result).toBe('vite-react');
    });

    it('returns cra for Create React App projects', () => {
      const packageJson = {
        dependencies: { 'react-scripts': '5.0.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectProjectType(testDir);
      expect(result).toBe('cra');
    });

    it('returns react for webpack + React projects', () => {
      fs.writeFileSync(path.join(testDir, 'webpack.config.js'), 'module.exports = {}');
      const packageJson = {
        dependencies: { react: '18.0.0' },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectProjectType(testDir);
      expect(result).toBe('react');
    });

    it('returns unknown for Vite without React', () => {
      fs.writeFileSync(path.join(testDir, 'vite.config.ts'), 'export default {}');
      const packageJson = { name: 'test' };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      const result = detectProjectType(testDir);
      expect(result).toBe('unknown');
    });
  });

  describe('isAppRouter', () => {
    it('returns true when app directory exists', () => {
      fs.mkdirSync(path.join(testDir, 'app'));
      const result = isAppRouter(testDir);
      expect(result).toBe(true);
    });

    it('returns true when src/app directory exists', () => {
      fs.mkdirSync(path.join(testDir, 'src', 'app'), { recursive: true });
      const result = isAppRouter(testDir);
      expect(result).toBe(true);
    });

    it('returns false when no app directory', () => {
      const result = isAppRouter(testDir);
      expect(result).toBe(false);
    });
  });

  describe('isPagesRouter', () => {
    it('returns true when pages directory exists', () => {
      fs.mkdirSync(path.join(testDir, 'pages'));
      const result = isPagesRouter(testDir);
      expect(result).toBe(true);
    });

    it('returns true when src/pages directory exists', () => {
      fs.mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true });
      const result = isPagesRouter(testDir);
      expect(result).toBe(true);
    });

    it('returns false when no pages directory', () => {
      const result = isPagesRouter(testDir);
      expect(result).toBe(false);
    });
  });

  describe('getSourceDir', () => {
    it('returns src directory when it exists', () => {
      fs.mkdirSync(path.join(testDir, 'src'));
      const result = getSourceDir(testDir);
      expect(result).toBe(path.join(testDir, 'src'));
    });

    it('returns root directory when no src', () => {
      const result = getSourceDir(testDir);
      expect(result).toBe(testDir);
    });
  });
});
