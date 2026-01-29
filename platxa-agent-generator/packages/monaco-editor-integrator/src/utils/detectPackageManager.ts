/**
 * Package Manager Detection Utility
 *
 * Detects the package manager used in a project by examining lockfiles.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PackageManager, LockfileInfo } from '../types/index.js';

/**
 * Lockfile patterns for each package manager.
 */
const LOCKFILE_PATTERNS: Record<PackageManager, string> = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
  bun: 'bun.lockb',
};

/**
 * Priority order for package manager detection.
 * When multiple lockfiles exist, prefer this order.
 */
const DETECTION_PRIORITY: PackageManager[] = ['pnpm', 'bun', 'yarn', 'npm'];

/**
 * Detects the lockfile present in a directory.
 *
 * @param rootDir - The directory to search for lockfiles
 * @returns LockfileInfo with type, path, and existence status
 */
export function detectLockfile(rootDir: string): LockfileInfo {
  for (const manager of DETECTION_PRIORITY) {
    const lockfilePath = path.join(rootDir, LOCKFILE_PATTERNS[manager]);
    if (fs.existsSync(lockfilePath)) {
      return {
        type: manager,
        path: lockfilePath,
        exists: true,
      };
    }
  }

  // Default to npm if no lockfile found
  return {
    type: 'npm',
    path: path.join(rootDir, LOCKFILE_PATTERNS.npm),
    exists: false,
  };
}

/**
 * Checks if a specific package manager is used by examining packageManager field.
 *
 * @param packageJsonPath - Path to package.json
 * @returns The package manager from packageManager field, or null
 */
export function detectFromPackageJson(packageJsonPath: string): PackageManager | null {
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content) as { packageManager?: string };

    if (typeof packageJson.packageManager === 'string') {
      const manager = packageJson.packageManager.split('@')[0];
      if (isValidPackageManager(manager)) {
        return manager;
      }
    }
  } catch {
    // File doesn't exist or is invalid JSON
  }

  return null;
}

/**
 * Type guard to check if a string is a valid PackageManager.
 *
 * @param value - The value to check
 * @returns True if value is a valid PackageManager
 */
function isValidPackageManager(value: string): value is PackageManager {
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(value);
}

/**
 * Detects the package manager used in a project.
 *
 * Detection priority:
 * 1. packageManager field in package.json (explicit declaration)
 * 2. Lockfile presence (pnpm > bun > yarn > npm)
 * 3. Default to npm if nothing found
 *
 * @param rootDir - The root directory of the project
 * @returns The detected PackageManager
 */
export function detectPackageManager(rootDir: string): PackageManager {
  const packageJsonPath = path.join(rootDir, 'package.json');

  // First, check packageManager field in package.json
  const explicitManager = detectFromPackageJson(packageJsonPath);
  if (explicitManager !== null) {
    return explicitManager;
  }

  // Then, check for lockfiles
  const lockfileInfo = detectLockfile(rootDir);
  return lockfileInfo.type;
}

/**
 * Gets the install command for a package manager.
 *
 * @param manager - The package manager
 * @param packages - Optional packages to install
 * @returns The install command string
 */
export function getInstallCommand(manager: PackageManager, packages?: string[]): string {
  const pkgList = packages?.join(' ') ?? '';

  switch (manager) {
    case 'pnpm':
      return packages !== undefined ? `pnpm add ${pkgList}` : 'pnpm install';
    case 'yarn':
      return packages !== undefined ? `yarn add ${pkgList}` : 'yarn install';
    case 'bun':
      return packages !== undefined ? `bun add ${pkgList}` : 'bun install';
    case 'npm':
    default:
      return packages !== undefined ? `npm install ${pkgList}` : 'npm install';
  }
}

/**
 * Gets the dev dependency install command for a package manager.
 *
 * @param manager - The package manager
 * @param packages - Packages to install as dev dependencies
 * @returns The install command string
 */
export function getDevInstallCommand(manager: PackageManager, packages: string[]): string {
  const pkgList = packages.join(' ');

  switch (manager) {
    case 'pnpm':
      return `pnpm add -D ${pkgList}`;
    case 'yarn':
      return `yarn add -D ${pkgList}`;
    case 'bun':
      return `bun add -d ${pkgList}`;
    case 'npm':
    default:
      return `npm install --save-dev ${pkgList}`;
  }
}
