/**
 * Performance Module Types
 *
 * Types for INP optimization, bundle analysis, lazy loading,
 * and React Compiler awareness.
 */

// =============================================================================
// INP Performance Optimization (#74)
// =============================================================================

/**
 * Interaction type for INP
 */
export type InteractionType = "click" | "keydown" | "pointerdown"

/**
 * INP issue severity
 */
export type INPSeverity = "good" | "needs-improvement" | "poor"

/**
 * INP issue detected in code
 */
export interface INPIssue {
  /** Issue identifier */
  id: string
  /** Issue type */
  type: "blocking-handler" | "sync-state" | "heavy-computation" | "layout-thrashing" | "forced-reflow"
  /** Severity */
  severity: INPSeverity
  /** Description */
  description: string
  /** Line number */
  line?: number
  /** Code snippet */
  snippet?: string
  /** Suggested fix */
  fix: string
  /** Estimated impact (ms saved) */
  estimatedImpact?: number
}

/**
 * INP analysis result
 */
export interface INPAnalysis {
  /** Overall INP score */
  score: INPSeverity
  /** Estimated INP time (ms) */
  estimatedINP: number
  /** Issues found */
  issues: INPIssue[]
  /** Recommendations */
  recommendations: string[]
  /** Event handlers analyzed */
  handlersAnalyzed: number
}

/**
 * INP optimization configuration
 */
export interface INPConfig {
  /** Target INP (ms) */
  targetINP?: number
  /** Check for specific interaction types */
  interactionTypes?: InteractionType[]
  /** Include recommendations */
  includeRecommendations?: boolean
}

// =============================================================================
// Bundle Size Analyzer (#75)
// =============================================================================

/**
 * Import type
 */
export type ImportType = "named" | "default" | "namespace" | "side-effect"

/**
 * Detected import
 */
export interface DetectedImport {
  /** Module specifier */
  module: string
  /** Import type */
  type: ImportType
  /** Imported names */
  names: string[]
  /** Estimated size (bytes) */
  estimatedSize: number
  /** Is tree-shakeable */
  treeShakeable: boolean
  /** Suggestion for optimization */
  suggestion?: string
}

/**
 * Bundle analysis result
 */
export interface BundleAnalysis {
  /** Total estimated size (bytes) */
  totalSize: number
  /** Size formatted */
  totalSizeFormatted: string
  /** All imports */
  imports: DetectedImport[]
  /** Heavy imports (>10KB) */
  heavyImports: DetectedImport[]
  /** Optimization opportunities */
  opportunities: Array<{
    type: "tree-shake" | "lazy-load" | "replace" | "remove"
    description: string
    potentialSavings: number
    potentialSavingsFormatted: string
  }>
  /** Score (0-100) */
  score: number
}

/**
 * Known package sizes (approximate gzipped)
 */
export interface PackageSizeMap {
  [packageName: string]: {
    full: number
    perExport?: Record<string, number>
  }
}

/**
 * Bundle analyzer configuration
 */
export interface BundleAnalyzerConfig {
  /** Custom package sizes */
  packageSizes?: PackageSizeMap
  /** Size threshold for warnings (bytes) */
  warningThreshold?: number
  /** Include dev dependencies */
  includeDevDeps?: boolean
}

// =============================================================================
// Lazy Loading Patterns (#76)
// =============================================================================

/**
 * Lazy loading strategy
 */
export type LazyStrategy =
  | "react-lazy"
  | "next-dynamic"
  | "intersection-observer"
  | "idle-callback"
  | "route-based"

/**
 * Lazy loading candidate
 */
export interface LazyCandidate {
  /** Component/element name */
  name: string
  /** Type of candidate */
  type: "component" | "image" | "script" | "data"
  /** Recommended strategy */
  strategy: LazyStrategy
  /** Line number */
  line?: number
  /** Current code */
  currentCode: string
  /** Suggested replacement */
  suggestedCode: string
  /** Priority (higher = more important) */
  priority: number
  /** Reason for suggestion */
  reason: string
}

/**
 * Lazy loading analysis result
 */
export interface LazyLoadingAnalysis {
  /** Candidates found */
  candidates: LazyCandidate[]
  /** Already lazy-loaded */
  alreadyLazy: string[]
  /** Total potential savings */
  potentialSavings: {
    initialBundle: number
    timeToInteractive: number
  }
  /** Generated code patterns */
  patterns: Record<LazyStrategy, string>
}

/**
 * Lazy loading configuration
 */
export interface LazyLoadingConfig {
  /** Strategies to consider */
  strategies?: LazyStrategy[]
  /** Minimum component size to suggest lazy loading */
  minSize?: number
  /** Include image lazy loading */
  includeImages?: boolean
  /** Framework (affects generated code) */
  framework?: "react" | "next" | "remix"
}

// =============================================================================
// React Compiler Optimization (#77)
// =============================================================================

/**
 * React Compiler compatibility status
 */
export type CompilerCompatibility = "compatible" | "needs-changes" | "incompatible"

/**
 * React Compiler issue
 */
export interface CompilerIssue {
  /** Issue type */
  type: "manual-memo" | "ref-mutation" | "effect-deps" | "unstable-reference" | "external-mutation"
  /** Description */
  description: string
  /** Line number */
  line?: number
  /** Code snippet */
  snippet?: string
  /** Is blocking */
  blocking: boolean
  /** Suggested fix */
  fix?: string
}

/**
 * React Compiler analysis result
 */
export interface CompilerAnalysis {
  /** Overall compatibility */
  compatibility: CompilerCompatibility
  /** Score (0-100) */
  score: number
  /** Issues found */
  issues: CompilerIssue[]
  /** Manual optimizations that can be removed */
  removableOptimizations: Array<{
    type: "useMemo" | "useCallback" | "React.memo"
    line: number
    reason: string
  }>
  /** Recommendations */
  recommendations: string[]
}

/**
 * React Compiler configuration
 */
export interface CompilerConfig {
  /** Strict mode */
  strict?: boolean
  /** Report removable optimizations */
  reportRemovable?: boolean
  /** Target React version */
  reactVersion?: "18" | "19"
}

// =============================================================================
// Factory Types
// =============================================================================

/**
 * Performance system configuration
 */
export interface PerformanceConfig {
  /** INP configuration */
  inp?: INPConfig
  /** Bundle analyzer configuration */
  bundle?: BundleAnalyzerConfig
  /** Lazy loading configuration */
  lazy?: LazyLoadingConfig
  /** React Compiler configuration */
  compiler?: CompilerConfig
}
