/**
 * Performance Module
 *
 * INP optimization, bundle analysis, lazy loading patterns,
 * and React Compiler awareness.
 */

// Types
export type {
  InteractionType,
  INPSeverity,
  INPIssue,
  INPAnalysis,
  INPConfig,
  ImportType,
  DetectedImport,
  BundleAnalysis,
  PackageSizeMap,
  BundleAnalyzerConfig,
  LazyStrategy,
  LazyCandidate,
  LazyLoadingAnalysis,
  LazyLoadingConfig,
  CompilerCompatibility,
  CompilerIssue,
  CompilerAnalysis,
  CompilerConfig,
  PerformanceConfig,
} from "./types"

// INP Optimization (#74)
export {
  DEFAULT_INP_CONFIG,
  analyzeINP,
} from "./performance"

// Bundle Size Analyzer (#75)
export {
  DEFAULT_PACKAGE_SIZES,
  DEFAULT_BUNDLE_CONFIG,
  analyzeBundleSize,
} from "./performance"

// Lazy Loading Patterns (#76)
export {
  DEFAULT_LAZY_CONFIG,
  LAZY_PATTERNS,
  analyzeLazyLoading,
} from "./performance"

// React Compiler Optimization (#77)
export {
  DEFAULT_COMPILER_CONFIG,
  analyzeCompilerCompatibility,
} from "./performance"

// Factory
export { createPerformanceSystem } from "./performance"
