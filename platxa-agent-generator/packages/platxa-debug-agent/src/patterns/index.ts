/**
 * Pattern Module
 *
 * Exports pattern types, loading, and validation functionality.
 *
 * @module patterns
 */

// Types
export type {
  BugPattern,
  PatternCollection,
  PatternMatch,
  PatternValidationResult,
  PatternSeverity,
  PatternCategory,
  FixType,
  PlaceholderSource,
  ASTPattern,
  ASTContext,
  FixTemplate,
  PlaceholderDefinition,
  PatternExample,
  PatternDocumentation,
  PatternConditions,
  PatternMetadata,
} from './pattern-types.js';

// Loader functions
export {
  loadPatterns,
  loadPatternById,
  validatePattern,
  validatePatternFile,
  createPatternCollection,
  getAvailableCategories,
  getAvailableSeverities,
  getSupportedLanguages,
  type LoadPatternsOptions,
  type LoadPatternsResult,
} from './pattern-loader.js';

// Pattern Matcher
export {
  PatternMatcher,
  createPatternMatcher,
  matchPatterns,
  type PatternMatcherConfig,
  type MatchContext,
  type ExtendedPatternMatch,
  type MatchResult,
} from './pattern-matcher.js';

// Async Pattern Detector
export {
  AsyncPatternDetector,
  createAsyncPatternDetector,
  detectAsyncPatterns,
  type AsyncPatternType,
  type AsyncPatternIssue,
  type AsyncPatternResult,
  type AsyncPatternConfig,
} from './async-pattern-detector.js';
