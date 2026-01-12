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

// Fix Validator
export { FixValidator, createFixValidator } from './core/fix-validator.js';
export type {
  TypeCheckError,
  TypeCheckResult,
  FixValidationResult,
  ValidationOptions,
  FixValidatorConfig,
} from './core/fix-validator.js';

// Test Runner
export { TestRunner, createTestRunner } from './core/test-runner.js';
export type {
  TestResult,
  TestSuiteResult,
  TestExecutionOptions,
  TestRunnerConfig,
} from './core/test-runner.js';

// Regression Detector
export { RegressionDetector, createRegressionDetector } from './core/regression-detector.js';
export type {
  BehaviorSnapshot,
  BehaviorMetrics,
  Regression,
  RegressionResult,
  RegressionDetectorConfig,
  RegressionDetectionOptions,
} from './core/regression-detector.js';

// Semantic Validator
export { SemanticValidator, createSemanticValidator } from './core/semantic-validator.js';
export type {
  TypeConstraint,
  Invariant,
  DataFlowConstraint,
  ValueRangeConstraint,
  SemanticValidationResult,
  ConstraintDefinition,
  SemanticValidatorConfig,
  SemanticValidationOptions,
} from './core/semantic-validator.js';

// Explanation Generator
export { ExplanationGenerator, createExplanationGenerator } from './core/explanation-generator.js';
export type {
  VerbosityLevel,
  ExplanationSection,
  CodeSnippet as ExplanationCodeSnippet,
  BugExplanation,
  RootCauseExplanation,
  FixExplanation,
  DebuggingExplanation,
  ExplanationGeneratorConfig,
} from './core/explanation-generator.js';

// Diff Visualizer
export { DiffVisualizer, createDiffVisualizer } from './core/diff-visualizer.js';
export type {
  DiffFormat,
  DiffOutput,
  LineChangeType,
  DiffLine,
  DiffHunk,
  FileDiff,
  SideBySideLine,
  DiffVisualization,
  DiffVisualizerConfig,
} from './core/diff-visualizer.js';

// Confidence Display
export { ConfidenceDisplay, createConfidenceDisplay } from './core/confidence-display.js';
export type {
  ConfidenceCategory,
  DisplayFormat,
  EvidenceCategory,
  IndicatorStyle,
  ConfidenceBreakdown,
  EvidenceSummary,
  ConfidenceDisplayResult,
  ConfidenceDisplayConfig,
} from './core/confidence-display.js';

// Fix Presenter
export { FixPresenter, createFixPresenter } from './core/fix-presenter.js';
export type {
  PresentationFormat,
  SelectionCriteria,
  TradeoffCategory,
  TradeoffAnalysis,
  FixComparison,
  FixPresentationResult,
  FixPresenterConfig,
} from './core/fix-presenter.js';

// CLAUDE.md Template Generator
export { ClaudeMdTemplate, createClaudeMdTemplate } from './core/claude-md-template.js';
export type {
  DebugToolConfig,
  LanguageDebugConfig,
  ProjectDebugConfig,
  ErrorPatternConfig,
  KnownIssueConfig,
  DebugPreferences,
  TemplateSection,
  GeneratedTemplate,
  ClaudeMdTemplateConfig,
} from './core/claude-md-template.js';

// Subagent Spawner
export {
  SubagentSpawner,
  createSubagentSpawner,
  MockSubagentExecutor,
  createMockExecutor,
} from './core/subagent-spawner.js';
export type {
  SubagentType,
  SubagentStatus,
  SubagentPriority,
  SubagentDefinition,
  SubagentTask,
  SubagentResult,
  SubagentFinding,
  VerificationPlan,
  VerificationResult,
  SubagentSpawnerConfig,
  SubagentExecutor,
} from './core/subagent-spawner.js';

// Log Pipe
export { LogPipe, createLogPipe } from './core/log-pipe.js';
export type {
  LogSourceType,
  LogEntry,
  LogPattern,
  ParsedLogError,
  LogBuffer,
  LogStreamHandler,
  LogPipeConfig,
} from './core/log-pipe.js';

// Debug Loop
export { DebugLoop, createDebugLoop } from './core/debug-loop.js';
export type {
  DebugLoopState,
  UserAction,
  LoggingInjection,
  DebugIteration,
  UserActionRecord,
  GatheredContext,
  DebugLoopHandlers,
  DebugLoopResult,
  DebugLoopConfig,
} from './core/debug-loop.js';

// MCP Browser Integration
export {
  MCPBrowserIntegration,
  createMCPBrowserIntegration,
} from './core/mcp-browser-integration.js';
export type {
  ConsoleLevel,
  ConsoleMessage,
  NetworkRequestStatus,
  NetworkRequest,
  PageSnapshot,
  MCPBrowserTool,
  ScreenshotOptions,
  BrowserDebugContext,
  MCPBrowserIntegrationConfig,
} from './core/mcp-browser-integration.js';

// Context Manager
export { ContextManager, createContextManager } from './core/context-manager.js';
export type {
  ContextItemType,
  ContextItem,
  ClearTriggerReason,
  ClearTrigger,
  ContextStats,
  ContextManagerConfig,
} from './core/context-manager.js';

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
