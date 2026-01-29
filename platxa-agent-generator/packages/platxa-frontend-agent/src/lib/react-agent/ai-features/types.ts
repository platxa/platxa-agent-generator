/**
 * AI Features Module Types
 *
 * Types for mockup-to-code, design critique, similarity search,
 * AutoFix, and context window management.
 */

// =============================================================================
// Mockup-to-Code Image Analyzer (#69)
// =============================================================================

/**
 * Detected UI element from mockup
 */
export interface DetectedElement {
  /** Element type */
  type: "button" | "input" | "card" | "image" | "text" | "container" | "list" | "nav" | "form" | "modal"
  /** Bounding box */
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Confidence score (0-1) */
  confidence: number
  /** Detected text content */
  text?: string
  /** Detected styles */
  styles?: {
    backgroundColor?: string
    textColor?: string
    fontSize?: string
    borderRadius?: string
    padding?: string
  }
  /** Child elements */
  children?: DetectedElement[]
}

/**
 * Color extracted from mockup
 */
export interface ExtractedColor {
  /** Hex value */
  hex: string
  /** RGB value */
  rgb: { r: number; g: number; b: number }
  /** Usage frequency (0-1) */
  frequency: number
  /** Suggested semantic name */
  semantic?: "primary" | "secondary" | "accent" | "background" | "foreground" | "muted"
}

/**
 * Mockup analysis result
 */
export interface MockupAnalysis {
  /** Detected UI elements */
  elements: DetectedElement[]
  /** Extracted color palette */
  colors: ExtractedColor[]
  /** Detected typography */
  typography: {
    headingFont?: string
    bodyFont?: string
    sizes: string[]
  }
  /** Layout information */
  layout: {
    type: "single-column" | "two-column" | "grid" | "sidebar" | "dashboard"
    spacing: string
    maxWidth?: string
  }
  /** Generated component suggestions */
  componentSuggestions: string[]
  /** Overall confidence */
  confidence: number
}

/**
 * Mockup analyzer configuration
 */
export interface MockupAnalyzerConfig {
  /** Minimum confidence threshold */
  minConfidence?: number
  /** Extract colors */
  extractColors?: boolean
  /** Detect typography */
  detectTypography?: boolean
  /** Max elements to detect */
  maxElements?: number
}

// =============================================================================
// Design Critique System (#70)
// =============================================================================

/**
 * Critique category
 */
export type CritiqueCategory =
  | "layout"
  | "typography"
  | "color"
  | "spacing"
  | "accessibility"
  | "consistency"
  | "usability"

/**
 * Critique severity
 */
export type CritiqueSeverity = "critical" | "major" | "minor" | "suggestion"

/**
 * Single critique item
 */
export interface CritiqueItem {
  /** Unique identifier */
  id: string
  /** Category */
  category: CritiqueCategory
  /** Severity level */
  severity: CritiqueSeverity
  /** Issue description */
  issue: string
  /** Suggested improvement */
  suggestion: string
  /** Affected element/line */
  location?: string
  /** Before/after example */
  example?: {
    before: string
    after: string
  }
}

/**
 * Design critique result
 */
export interface DesignCritique {
  /** Overall score (0-10) */
  score: number
  /** All critique items */
  items: CritiqueItem[]
  /** Items by severity */
  critical: CritiqueItem[]
  major: CritiqueItem[]
  minor: CritiqueItem[]
  suggestions: CritiqueItem[]
  /** Summary */
  summary: string
  /** Top improvements */
  topImprovements: string[]
}

/**
 * Critique configuration
 */
export interface CritiqueConfig {
  /** Categories to check */
  categories?: CritiqueCategory[]
  /** Minimum severity to report */
  minSeverity?: CritiqueSeverity
  /** Include suggestions */
  includeSuggestions?: boolean
  /** Design system rules to enforce */
  designSystem?: {
    colors?: string[]
    spacing?: number[]
    fonts?: string[]
  }
}

// =============================================================================
// Component Similarity Search (#71)
// =============================================================================

/**
 * Component signature for matching
 */
export interface ComponentSignature {
  /** Component name */
  name: string
  /** Props structure */
  props: string[]
  /** Has variants */
  hasVariants: boolean
  /** Variant names */
  variants?: string[]
  /** Uses forwardRef */
  usesForwardRef: boolean
  /** Has accessibility features */
  hasA11y: boolean
  /** Estimated complexity (1-10) */
  complexity: number
  /** Tags/keywords */
  tags: string[]
}

/**
 * Similarity match result
 */
export interface SimilarityMatch {
  /** Matched component name */
  name: string
  /** Similarity score (0-1) */
  score: number
  /** Match reasons */
  matchReasons: string[]
  /** Source (library or local) */
  source: "shadcn" | "radix" | "headless" | "local" | "custom"
  /** Import path */
  importPath?: string
  /** Suggested adaptations */
  adaptations?: string[]
}

/**
 * Similarity search result
 */
export interface SimilaritySearchResult {
  /** Query component */
  query: string
  /** Top matches */
  matches: SimilarityMatch[]
  /** Best match */
  bestMatch?: SimilarityMatch
  /** Confidence in results */
  confidence: number
}

/**
 * Component library for matching
 */
export interface ComponentLibrary {
  /** Library name */
  name: string
  /** Component signatures */
  components: ComponentSignature[]
}

// =============================================================================
// AutoFix Post-Processor (#72)
// =============================================================================

/**
 * AutoFix rule type
 */
export type AutoFixRule =
  | "add-display-name"
  | "add-forward-ref"
  | "fix-any-types"
  | "add-aria-labels"
  | "fix-imports"
  | "format-code"
  | "add-use-client"
  | "fix-key-props"
  | "add-error-boundary"

/**
 * AutoFix result
 */
export interface AutoFixResult {
  /** Original code */
  original: string
  /** Fixed code */
  fixed: string
  /** Applied fixes */
  appliedFixes: Array<{
    rule: AutoFixRule
    description: string
    line?: number
  }>
  /** Fixes that couldn't be applied */
  skippedFixes: Array<{
    rule: AutoFixRule
    reason: string
  }>
  /** Number of changes */
  changeCount: number
}

/**
 * AutoFix configuration
 */
export interface AutoFixConfig {
  /** Rules to apply */
  rules?: AutoFixRule[]
  /** Rules to skip */
  skipRules?: AutoFixRule[]
  /** Dry run (don't modify) */
  dryRun?: boolean
  /** Format after fixing */
  format?: boolean
}

// =============================================================================
// Context Window Management (#73)
// =============================================================================

/**
 * Context item type
 */
export type ContextItemType =
  | "component"
  | "type"
  | "utility"
  | "style"
  | "config"
  | "test"
  | "documentation"

/**
 * Context item
 */
export interface ContextItem {
  /** Item identifier */
  id: string
  /** Item type */
  type: ContextItemType
  /** File path */
  path: string
  /** Content */
  content: string
  /** Token count estimate */
  tokens: number
  /** Priority (higher = more important) */
  priority: number
  /** Dependencies */
  dependencies?: string[]
  /** Last accessed */
  lastAccessed?: number
}

/**
 * Context window state
 */
export interface ContextWindow {
  /** Maximum tokens */
  maxTokens: number
  /** Current token usage */
  usedTokens: number
  /** Items in context */
  items: ContextItem[]
  /** Available capacity */
  availableTokens: number
  /** Utilization percentage */
  utilization: number
}

/**
 * Context optimization result
 */
export interface ContextOptimization {
  /** Original items */
  original: ContextItem[]
  /** Optimized items */
  optimized: ContextItem[]
  /** Removed items */
  removed: ContextItem[]
  /** Token savings */
  tokensSaved: number
  /** Compression ratio */
  compressionRatio: number
}

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  /** Maximum tokens */
  maxTokens?: number
  /** Reserved tokens for response */
  reservedTokens?: number
  /** Priority weights by type */
  typeWeights?: Partial<Record<ContextItemType, number>>
  /** Enable compression */
  enableCompression?: boolean
}

// =============================================================================
// Factory Types
// =============================================================================

/**
 * AI Features system configuration
 */
export interface AIFeaturesConfig {
  /** Mockup analyzer config */
  mockup?: MockupAnalyzerConfig
  /** Critique config */
  critique?: CritiqueConfig
  /** AutoFix config */
  autofix?: AutoFixConfig
  /** Context manager config */
  context?: ContextManagerConfig
}
