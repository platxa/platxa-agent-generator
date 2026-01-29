/**
 * AI Features Module
 *
 * Mockup-to-code analysis, design critique, similarity search,
 * AutoFix post-processing, and context window management.
 */

// Types
export type {
  DetectedElement,
  ExtractedColor,
  MockupAnalysis,
  MockupAnalyzerConfig,
  CritiqueCategory,
  CritiqueSeverity,
  CritiqueItem,
  DesignCritique,
  CritiqueConfig,
  ComponentSignature,
  SimilarityMatch,
  SimilaritySearchResult,
  ComponentLibrary,
  AutoFixRule,
  AutoFixResult,
  AutoFixConfig,
  ContextItemType,
  ContextItem,
  ContextWindow,
  ContextOptimization,
  ContextManagerConfig,
  AIFeaturesConfig,
} from "./types"

// Mockup-to-Code (#69)
export {
  DEFAULT_MOCKUP_CONFIG,
  analyzeMockupDescription,
  generateCodeFromAnalysis,
} from "./ai-features"

// Design Critique (#70)
export {
  DEFAULT_CRITIQUE_CONFIG,
  generateDesignCritique,
} from "./ai-features"

// Component Similarity Search (#71)
export {
  SHADCN_LIBRARY,
  extractComponentSignature,
  searchSimilarComponents,
} from "./ai-features"

// AutoFix Post-Processor (#72)
export {
  DEFAULT_AUTOFIX_CONFIG,
  applyAutoFix,
} from "./ai-features"

// Context Window Management (#73)
export {
  DEFAULT_CONTEXT_CONFIG,
  estimateTokens,
  createContextItem,
  createContextWindow,
  addToContext,
  optimizeContext,
  compressContent,
} from "./ai-features"

// Factory
export { createAIFeaturesSystem } from "./ai-features"
