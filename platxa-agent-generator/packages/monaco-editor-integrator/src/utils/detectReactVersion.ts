/**
 * React Version Detection Utility
 *
 * Detects React version and TypeScript configuration in a project.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Parsed version information.
 */
export interface VersionInfo {
  /** Raw version string from package.json */
  raw: string;
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number */
  patch: number;
}

/**
 * React compatibility information.
 */
export interface ReactCompatibility {
  /** React version if detected */
  version: string | null;
  /** Parsed version info */
  versionInfo: VersionInfo | null;
  /** Whether React 18+ concurrent features are available */
  hasConcurrentFeatures: boolean;
  /** Whether hooks are available (React 16.8+) */
  hasHooks: boolean;
  /** Whether the version is compatible with Monaco integration */
  isCompatible: boolean;
  /** Compatibility message */
  message: string;
}

/**
 * Minimum React version for Monaco + Yjs integration.
 */
const MIN_REACT_VERSION = { major: 17, minor: 0, patch: 0 };

/**
 * Parses a semver version string.
 *
 * @param version - Version string (e.g., "18.2.0", "^18.0.0", "~17.0.2")
 * @returns Parsed VersionInfo or null if invalid
 */
export function parseVersion(version: string): VersionInfo | null {
  // Remove version prefix characters (^, ~, >=, etc.)
  const cleanVersion = version.replace(/^[\^~>=<]+/, '');

  // Match semver pattern
  const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (match === null) {
    return null;
  }

  return {
    raw: version,
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compares two versions.
 *
 * @param a - First version
 * @param b - Second version
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: VersionInfo, b: VersionInfo): number {
  if (a.major !== b.major) {
    return a.major < b.major ? -1 : 1;
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor ? -1 : 1;
  }
  if (a.patch !== b.patch) {
    return a.patch < b.patch ? -1 : 1;
  }
  return 0;
}

/**
 * Reads a dependency version from package.json.
 *
 * @param rootDir - The directory containing package.json
 * @param packageName - The package name to look for
 * @returns The version string or null if not found
 */
function getDependencyVersion(rootDir: string, packageName: string): string | null {
  const packageJsonPath = path.join(rootDir, 'package.json');

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    // Check dependencies first, then devDependencies
    const version =
      packageJson.dependencies?.[packageName] ??
      packageJson.devDependencies?.[packageName] ??
      null;

    return version;
  } catch {
    return null;
  }
}

/**
 * Detects the React version in a project.
 *
 * @param rootDir - The root directory of the project
 * @returns The React version string or null if not found
 */
export function detectReactVersion(rootDir: string): string | null {
  return getDependencyVersion(rootDir, 'react');
}

/**
 * Detects the TypeScript version in a project.
 *
 * @param rootDir - The root directory of the project
 * @returns The TypeScript version string or null if not found
 */
export function detectTypescriptVersion(rootDir: string): string | null {
  return getDependencyVersion(rootDir, 'typescript');
}

/**
 * Checks if a project uses TypeScript.
 *
 * @param rootDir - The root directory of the project
 * @returns True if TypeScript is configured
 */
export function hasTypeScript(rootDir: string): boolean {
  // Check for tsconfig.json
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    return true;
  }

  // Check for TypeScript dependency
  const tsVersion = detectTypescriptVersion(rootDir);
  return tsVersion !== null;
}

/**
 * Analyzes React compatibility for Monaco + Yjs integration.
 *
 * @param rootDir - The root directory of the project
 * @returns ReactCompatibility analysis
 */
export function analyzeReactCompatibility(rootDir: string): ReactCompatibility {
  const version = detectReactVersion(rootDir);

  if (version === null) {
    return {
      version: null,
      versionInfo: null,
      hasConcurrentFeatures: false,
      hasHooks: false,
      isCompatible: false,
      message: 'React not found in project dependencies',
    };
  }

  const versionInfo = parseVersion(version);

  if (versionInfo === null) {
    return {
      version,
      versionInfo: null,
      hasConcurrentFeatures: false,
      hasHooks: false,
      isCompatible: false,
      message: `Unable to parse React version: ${version}`,
    };
  }

  const hasConcurrentFeatures = versionInfo.major >= 18;
  const hasHooks = versionInfo.major > 16 || (versionInfo.major === 16 && versionInfo.minor >= 8);

  const minVersion: VersionInfo = {
    raw: '17.0.0',
    ...MIN_REACT_VERSION,
  };

  const isCompatible = compareVersions(versionInfo, minVersion) >= 0;

  let message: string;
  if (!isCompatible) {
    message = `React ${version} is not compatible. Minimum required: 17.0.0`;
  } else if (hasConcurrentFeatures) {
    message = `React ${version} fully supported with concurrent features`;
  } else {
    message = `React ${version} supported (upgrade to 18+ recommended for best performance)`;
  }

  return {
    version,
    versionInfo,
    hasConcurrentFeatures,
    hasHooks,
    isCompatible,
    message,
  };
}
