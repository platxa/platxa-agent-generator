/**
 * Platxa Debug Agent
 *
 * Production-grade multi-language AI debugging agent for Claude Code.
 * Supports Python, JavaScript, TypeScript, CSS, SCSS, Tailwind, HTML, and more.
 *
 * @packageDocumentation
 */

// Core types
export type {
  Language,
  ConfidenceLevel,
  LanguageDetectionResult,
  ErrorSeverity,
  ErrorSource,
  SourceLocation,
  StackFrame,
  NormalizedError,
  RootCauseHypothesis,
  Evidence,
  FixSuggestion,
  CodeChange,
  ValidationStep,
  ModuleAnalysisResult,
  LanguageModule,
  AnalysisContext,
  ValidationResult,
  OrchestratorConfig,
  DebugSession,
  DebugEvent,
} from './core/types.js';

// Language detection
export { LanguageDetector } from './core/language-detector.js';

// Error parsing
export { ErrorParser, createErrorParser } from './core/error-parser.js';
export type { ErrorParserConfig } from './core/error-parser.js';

// Orchestrator
export { Orchestrator, createOrchestrator } from './core/orchestrator.js';

// Context Engine
export { ContextEngine, createContextEngine } from './core/context-engine.js';
export type {
  ASTNode,
  SymbolInfo,
  ParameterInfo,
  ImportInfo,
  ImportedName,
  CodeContext,
  FileContext,
  ContextExtractionOptions,
} from './core/context-engine.js';

// RCA Engine
export { RCAEngine, createRCAEngine } from './core/rca-engine.js';
export type {
  ErrorPattern,
  FixTemplate,
  LLMPromptTemplate,
  HypothesisGenerationResult,
  GeneratedPrompt,
  RCAEngineConfig,
} from './core/rca-engine.js';

// Confidence Scorer
export { ConfidenceScorer, createConfidenceScorer, quickScore } from './core/confidence-scorer.js';
export type {
  ScoringStrategy,
  EvidenceTypeWeights,
  ConfidenceScorerConfig,
  ScoreBreakdown,
  EvidenceContribution,
  ScoreAdjustment,
  EvidenceConflict,
  EvidenceCorrelation,
  ScoreQuality,
} from './core/confidence-scorer.js';

// Fix Database (RAG System)
export { FixDatabase, createFixDatabase, createFixDatabaseWithDefaults } from './core/fix-database.js';
export type {
  BugFixEntry,
  BugFix,
  BugSearchQuery,
  BugSearchResult,
  SimilarityBreakdown,
  FixDatabaseConfig,
  DatabaseStats,
} from './core/fix-database.js';

// Fix Generator (Template-based)
export { FixGenerator, createFixGenerator } from './core/fix-generator.js';
export type {
  FixGeneratorTemplate,
  TemplateVariables,
  GeneratedFix,
  FixGeneratorConfig,
} from './core/fix-generator.js';

// LLM Patch Synthesizer
export { LLMPatchSynthesizer, createLLMPatchSynthesizer } from './core/llm-patch-synthesizer.js';
export type {
  PatchPromptTemplate,
  ResponseFormat,
  ResponseMarkers,
  GenerationParameters,
  ParsedPatch,
  SynthesisAttempt,
  SynthesisResult,
  SynthesisContext,
  CodeSnippet,
  FileContent,
  LLMPatchSynthesizerConfig,
} from './core/llm-patch-synthesizer.js';

// Language Modules
export { PythonModule, createPythonModule } from './modules/python-module.js';
export {
  JavaScriptModule,
  createJavaScriptModule,
  createTypeScriptModule,
} from './modules/javascript-module.js';
export {
  CSSModule,
  createCSSModule,
  createSCSSModule,
  createTailwindModule,
} from './modules/css-module.js';
