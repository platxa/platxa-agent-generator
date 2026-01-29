/**
 * Monaco Editor Integrator - Utilities
 *
 * Project detection and analysis utilities for Monaco + Yjs integration.
 */

// Package manager detection
export {
  detectPackageManager,
  detectLockfile,
  detectFromPackageJson,
  getInstallCommand,
  getDevInstallCommand,
} from './detectPackageManager.js';

// Build tool detection
export {
  detectBuildTool,
  detectProjectType,
  isAppRouter,
  isPagesRouter,
  getSourceDir,
} from './detectBuildTool.js';

// React version detection
export {
  detectReactVersion,
  detectTypescriptVersion,
  hasTypeScript,
  analyzeReactCompatibility,
  parseVersion,
  compareVersions,
  type VersionInfo,
  type ReactCompatibility,
} from './detectReactVersion.js';

// Monaco/Yjs dependency detection
export {
  detectExistingMonaco,
  analyzeMonacoIntegration,
  checkVersionConflicts,
  hasMonacoEditor,
  hasYjs,
  REQUIRED_PACKAGES,
  RECOMMENDED_VERSIONS,
  type VersionConflict,
  type MonacoAnalysis,
} from './detectExistingMonaco.js';
