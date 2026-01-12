/**
 * Build Tool Detection Utility
 *
 * Detects the build tool/framework used in a project by examining config files.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BuildTool, ProjectType } from '../types/index.js';

/**
 * Config file patterns for each build tool.
 */
interface BuildToolConfig {
  /** Files that indicate this build tool */
  configFiles: string[];
  /** Package.json dependencies that indicate this build tool */
  dependencies: string[];
  /** Priority (lower = higher priority) */
  priority: number;
}

const BUILD_TOOL_CONFIGS: Record<BuildTool, BuildToolConfig> = {
  nextjs: {
    configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    dependencies: ['next'],
    priority: 1,
  },
  vite: {
    configFiles: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    dependencies: ['vite'],
    priority: 2,
  },
  cra: {
    configFiles: [],
    dependencies: ['react-scripts'],
    priority: 3,
  },
  webpack: {
    configFiles: ['webpack.config.js', 'webpack.config.ts'],
    dependencies: ['webpack'],
    priority: 4,
  },
  unknown: {
    configFiles: [],
    dependencies: [],
    priority: 99,
  },
};

/**
 * Reads and parses package.json from a directory.
 *
 * @param rootDir - The directory containing package.json
 * @returns Parsed package.json or null if not found/invalid
 */
function readPackageJson(rootDir: string): Record<string, unknown> | null {
  const packageJsonPath = path.join(rootDir, 'package.json');
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Checks if any of the specified config files exist in the directory.
 *
 * @param rootDir - The directory to check
 * @param configFiles - Array of config file names to look for
 * @returns True if any config file exists
 */
function hasConfigFile(rootDir: string, configFiles: string[]): boolean {
  return configFiles.some((file) => fs.existsSync(path.join(rootDir, file)));
}

/**
 * Checks if any of the specified dependencies exist in package.json.
 *
 * @param packageJson - Parsed package.json object
 * @param dependencies - Array of dependency names to look for
 * @returns True if any dependency is found
 */
function hasDependency(packageJson: Record<string, unknown>, dependencies: string[]): boolean {
  const deps = packageJson.dependencies as Record<string, string> | undefined;
  const devDeps = packageJson.devDependencies as Record<string, string> | undefined;

  return dependencies.some((dep) => {
    const inDeps = deps !== undefined && dep in deps;
    const inDevDeps = devDeps !== undefined && dep in devDeps;
    return inDeps || inDevDeps;
  });
}

/**
 * Detects the build tool used in a project.
 *
 * Detection priority:
 * 1. Config files (next.config.js, vite.config.ts, etc.) - checked first across ALL tools
 * 2. Package.json dependencies (next, vite, react-scripts, webpack) - checked second
 *
 * @param rootDir - The root directory of the project
 * @returns The detected BuildTool
 */
export function detectBuildTool(rootDir: string): BuildTool {
  const packageJson = readPackageJson(rootDir);
  const buildTools: BuildTool[] = ['nextjs', 'vite', 'cra', 'webpack'];

  // First pass: Check config files (strongest signal)
  for (const tool of buildTools) {
    const config = BUILD_TOOL_CONFIGS[tool];
    if (config.configFiles.length > 0 && hasConfigFile(rootDir, config.configFiles)) {
      return tool;
    }
  }

  // Second pass: Check dependencies
  for (const tool of buildTools) {
    const config = BUILD_TOOL_CONFIGS[tool];
    if (packageJson !== null && hasDependency(packageJson, config.dependencies)) {
      return tool;
    }
  }

  return 'unknown';
}

/**
 * Detects the project type based on build tool and framework.
 *
 * @param rootDir - The root directory of the project
 * @returns The detected ProjectType
 */
export function detectProjectType(rootDir: string): ProjectType {
  const buildTool = detectBuildTool(rootDir);
  const packageJson = readPackageJson(rootDir);

  // Check for React
  const hasReact =
    packageJson !== null && hasDependency(packageJson, ['react', 'react-dom']);

  switch (buildTool) {
    case 'nextjs':
      return 'nextjs';
    case 'vite':
      return hasReact ? 'vite-react' : 'unknown';
    case 'cra':
      return 'cra';
    case 'webpack':
      return hasReact ? 'react' : 'unknown';
    default:
      return hasReact ? 'react' : 'unknown';
  }
}

/**
 * Checks if a project is a Next.js App Router project.
 *
 * @param rootDir - The root directory of the project
 * @returns True if using App Router
 */
export function isAppRouter(rootDir: string): boolean {
  const appDir = path.join(rootDir, 'app');
  const srcAppDir = path.join(rootDir, 'src', 'app');

  return fs.existsSync(appDir) || fs.existsSync(srcAppDir);
}

/**
 * Checks if a project is a Next.js Pages Router project.
 *
 * @param rootDir - The root directory of the project
 * @returns True if using Pages Router
 */
export function isPagesRouter(rootDir: string): boolean {
  const pagesDir = path.join(rootDir, 'pages');
  const srcPagesDir = path.join(rootDir, 'src', 'pages');

  return fs.existsSync(pagesDir) || fs.existsSync(srcPagesDir);
}

/**
 * Gets the source directory for a project.
 *
 * @param rootDir - The root directory of the project
 * @returns The source directory path
 */
export function getSourceDir(rootDir: string): string {
  const srcDir = path.join(rootDir, 'src');

  if (fs.existsSync(srcDir)) {
    return srcDir;
  }

  return rootDir;
}
