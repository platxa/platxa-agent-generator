/**
 * Existing Monaco/Yjs Detection Utility
 *
 * Detects existing Monaco Editor and Yjs dependencies in a project
 * to identify potential conflicts and upgrade paths.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ExistingDependencies } from '../types/index.js';
import { parseVersion } from './detectReactVersion.js';

/**
 * Required packages for Monaco + Yjs integration.
 */
export const REQUIRED_PACKAGES = {
  core: ['monaco-editor', '@monaco-editor/react'],
  yjs: ['yjs', 'y-monaco'],
  sync: ['y-websocket'],
  optional: ['y-indexeddb'],
} as const;

/**
 * Recommended version ranges for each package.
 */
export const RECOMMENDED_VERSIONS: Record<string, string> = {
  'monaco-editor': '^0.45.0',
  '@monaco-editor/react': '^4.6.0',
  yjs: '^13.6.0',
  'y-monaco': '^0.1.6',
  'y-websocket': '^2.0.0',
  'y-indexeddb': '^9.0.0',
};

/**
 * Version conflict information.
 */
export interface VersionConflict {
  /** Package name */
  package: string;
  /** Installed version */
  installed: string;
  /** Recommended version */
  recommended: string;
  /** Severity of the conflict */
  severity: 'warning' | 'error';
  /** Description of the issue */
  message: string;
}

/**
 * Monaco integration analysis result.
 */
export interface MonacoAnalysis {
  /** Existing dependencies found */
  existing: ExistingDependencies;
  /** Missing required packages */
  missingRequired: string[];
  /** Missing optional packages */
  missingOptional: string[];
  /** Version conflicts detected */
  conflicts: VersionConflict[];
  /** Whether the project is ready for integration */
  isReady: boolean;
  /** Install command for missing packages */
  installCommand: string | null;
}

/**
 * Reads package.json and extracts dependency versions.
 *
 * @param rootDir - The directory containing package.json
 * @returns Object with dependencies and devDependencies
 */
function readDependencies(rootDir: string): {
  deps: Record<string, string>;
  devDeps: Record<string, string>;
} {
  const packageJsonPath = path.join(rootDir, 'package.json');

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return {
      deps: packageJson.dependencies ?? {},
      devDeps: packageJson.devDependencies ?? {},
    };
  } catch {
    return { deps: {}, devDeps: {} };
  }
}

/**
 * Gets the version of a package from dependencies.
 *
 * @param packageName - The package name
 * @param deps - Dependencies object
 * @param devDeps - Dev dependencies object
 * @returns Version string or null if not found
 */
function getPackageVersion(
  packageName: string,
  deps: Record<string, string>,
  devDeps: Record<string, string>
): string | null {
  return deps[packageName] ?? devDeps[packageName] ?? null;
}

/**
 * Detects existing Monaco and Yjs dependencies in a project.
 *
 * @param rootDir - The root directory of the project
 * @returns ExistingDependencies object
 */
export function detectExistingMonaco(rootDir: string): ExistingDependencies {
  const { deps, devDeps } = readDependencies(rootDir);

  return {
    monacoEditor: getPackageVersion('monaco-editor', deps, devDeps),
    monacoReact: getPackageVersion('@monaco-editor/react', deps, devDeps),
    yjs: getPackageVersion('yjs', deps, devDeps),
    yMonaco: getPackageVersion('y-monaco', deps, devDeps),
    yWebsocket: getPackageVersion('y-websocket', deps, devDeps),
    yIndexeddb: getPackageVersion('y-indexeddb', deps, devDeps),
  };
}

/**
 * Checks for version conflicts with recommended versions.
 *
 * @param existing - Existing dependencies
 * @returns Array of version conflicts
 */
export function checkVersionConflicts(existing: ExistingDependencies): VersionConflict[] {
  const conflicts: VersionConflict[] = [];

  const checkPackage = (
    name: keyof ExistingDependencies,
    packageName: string
  ): void => {
    const installed = existing[name];
    if (installed === null) {
      return;
    }

    const installedVersion = parseVersion(installed);
    const recommended = RECOMMENDED_VERSIONS[packageName];
    const recommendedVersion = parseVersion(recommended);

    if (installedVersion === null || recommendedVersion === null) {
      return;
    }

    // Check for major version mismatch
    if (installedVersion.major < recommendedVersion.major) {
      conflicts.push({
        package: packageName,
        installed,
        recommended,
        severity: 'error',
        message: `Major version mismatch: ${packageName}@${installed} is older than recommended ${recommended}`,
      });
    }
    // Check for y-websocket v3 (breaking change)
    else if (packageName === 'y-websocket' && installedVersion.major >= 3) {
      conflicts.push({
        package: packageName,
        installed,
        recommended,
        severity: 'error',
        message: `y-websocket v3+ has breaking API changes. Use v2.x for y-monaco compatibility`,
      });
    }
  };

  checkPackage('monacoEditor', 'monaco-editor');
  checkPackage('monacoReact', '@monaco-editor/react');
  checkPackage('yjs', 'yjs');
  checkPackage('yMonaco', 'y-monaco');
  checkPackage('yWebsocket', 'y-websocket');
  checkPackage('yIndexeddb', 'y-indexeddb');

  return conflicts;
}

/**
 * Analyzes a project for Monaco + Yjs integration readiness.
 *
 * @param rootDir - The root directory of the project
 * @returns MonacoAnalysis result
 */
export function analyzeMonacoIntegration(rootDir: string): MonacoAnalysis {
  const existing = detectExistingMonaco(rootDir);
  const conflicts = checkVersionConflicts(existing);

  // Check for missing required packages
  const missingRequired: string[] = [];

  for (const pkg of REQUIRED_PACKAGES.core) {
    const key = pkg === 'monaco-editor' ? 'monacoEditor' : 'monacoReact';
    if (existing[key] === null) {
      missingRequired.push(pkg);
    }
  }

  for (const pkg of REQUIRED_PACKAGES.yjs) {
    const key = pkg === 'yjs' ? 'yjs' : 'yMonaco';
    if (existing[key] === null) {
      missingRequired.push(pkg);
    }
  }

  for (const pkg of REQUIRED_PACKAGES.sync) {
    if (existing.yWebsocket === null) {
      missingRequired.push(pkg);
    }
  }

  // Check for missing optional packages
  const missingOptional: string[] = [];
  for (const pkg of REQUIRED_PACKAGES.optional) {
    if (existing.yIndexeddb === null) {
      missingOptional.push(pkg);
    }
  }

  // Determine if ready (no missing required, no error-level conflicts)
  const hasErrorConflicts = conflicts.some((c) => c.severity === 'error');
  const isReady = missingRequired.length === 0 && !hasErrorConflicts;

  // Generate install command for missing packages
  let installCommand: string | null = null;
  if (missingRequired.length > 0) {
    const packagesWithVersions = missingRequired.map(
      (pkg) => `${pkg}@${RECOMMENDED_VERSIONS[pkg] ?? 'latest'}`
    );
    installCommand = packagesWithVersions.join(' ');
  }

  return {
    existing,
    missingRequired,
    missingOptional,
    conflicts,
    isReady,
    installCommand,
  };
}

/**
 * Checks if Monaco Editor is already installed.
 *
 * @param rootDir - The root directory of the project
 * @returns True if Monaco Editor is installed
 */
export function hasMonacoEditor(rootDir: string): boolean {
  const existing = detectExistingMonaco(rootDir);
  return existing.monacoEditor !== null || existing.monacoReact !== null;
}

/**
 * Checks if Yjs is already installed.
 *
 * @param rootDir - The root directory of the project
 * @returns True if Yjs is installed
 */
export function hasYjs(rootDir: string): boolean {
  const existing = detectExistingMonaco(rootDir);
  return existing.yjs !== null;
}
