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
  SelfDebugConfig,
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

// Analysis Cache
export {
  AnalysisCache,
  createAnalysisCache,
  getSharedCache,
  resetSharedCache,
} from './core/analysis-cache.js';
export type {
  CacheEntryType,
  CacheEntryMetadata,
  CacheEntry,
  CacheStats,
  EvictionPolicy,
  AnalysisCacheConfig,
} from './core/analysis-cache.js';

// Parallel Analyzer
export { ParallelAnalyzer, createParallelAnalyzer } from './core/parallel-analyzer.js';
export type {
  TaskStatus,
  TaskPriority,
  AnalysisTask,
  BatchAnalysisRequest,
  BatchAnalysisResult,
  ProgressCallback,
  ParallelAnalyzerConfig,
} from './core/parallel-analyzer.js';

// Incremental Analyzer
export {
  IncrementalAnalyzer,
  createIncrementalAnalyzer,
} from './core/incremental-analyzer.js';
export type {
  FileChangeType,
  FileState,
  FileChange,
  ChangeSet,
  IncrementalAnalysisResult,
  DependencyResolver,
  IncrementalAnalyzerConfig,
} from './core/incremental-analyzer.js';

// CI/CD Integration
export {
  CICDIntegration,
  createCICDIntegration,
  detectCICDEnvironment,
} from './core/cicd-integration.js';
export type {
  CICDPlatform,
  ReportFormat,
  CICDSeverity,
  CICDEnvironment,
  SARIFResult,
  SARIFReport,
  JUnitTestCase,
  JUnitTestSuite,
  DebugReport,
  PRComment,
  CICDIntegrationConfig,
} from './core/cicd-integration.js';

// VS Code Integration
export {
  VSCodeIntegration,
  createVSCodeIntegration,
  mapLanguageId,
  getLanguageId,
} from './core/vscode-integration.js';
export type {
  VSCodeSeverity,
  VSCodePosition,
  VSCodeRange,
  VSCodeDiagnostic,
  VSCodeCodeAction,
  VSCodeWorkspaceEdit,
  VSCodeTextEdit,
  VSCodeHover,
  VSCodeDocumentLink,
  DebugSessionStatus,
  RealTimeDebugSession,
  ExtensionMessageType,
  ExtensionMessage,
  AgentResponse,
  AnalyzeRequest,
  AnalyzeResponse,
  VSCodeIntegrationConfig,
} from './core/vscode-integration.js';

// Metrics Dashboard
export {
  MetricsDashboard,
  createMetricsDashboard,
  getSharedDashboard,
  resetSharedDashboard,
} from './core/metrics-dashboard.js';
export type {
  MetricsPeriod,
  MetricCategory,
  SessionOutcome,
  SessionMetrics,
  ErrorPatternMetrics,
  FixEffectivenessMetrics,
  PerformanceMetrics,
  LanguageMetrics,
  DashboardMetrics,
  ExportFormat,
  MetricsDashboardConfig,
} from './core/metrics-dashboard.js';

// Causal Chain Reconstructor
export {
  CausalChainReconstructor,
  createCausalChainReconstructor,
  reconstructCausalChain,
  generateCausalHypotheses,
} from './core/causal-chain.js';
export type {
  CausalRelationType,
  CausalNode,
  CausalNodeType,
  CausalEdge,
  CausalChain,
  CausalHypothesis,
  DataFlowInfo,
  DataTransformation,
  CausalChainConfig,
} from './core/causal-chain.js';

// SBFL Analyzer
export {
  SBFLAnalyzer,
  createSBFLAnalyzer,
  analyzeFaultLocalization,
  getTopSuspiciousLines,
} from './core/sbfl-analyzer.js';
export type {
  SBFLFormula,
  CodeElement,
  TestExecution,
  CoverageSpectrum,
  SuspiciousnessScore,
  ExecutionStats,
  SBFLResult,
  SBFLStatistics,
  SBFLConfig,
} from './core/sbfl-analyzer.js';

// Semantic Similarity
export {
  SemanticSimilarityExtractor,
  createSemanticSimilarityExtractor,
  compareCode,
  findRelatedCode,
} from './core/semantic-similarity.js';
export type {
  TokenType,
  CodeToken,
  CodeStructure,
  SimilarityBreakdown as SemanticSimilarityBreakdown,
  SimilarityResult,
  CodeSnippet as SemanticCodeSnippet,
  CodeDifference,
  RelatedCodeMatch,
  SemanticSimilarityConfig,
} from './core/semantic-similarity.js';

// Git Analyzer
export { GitAnalyzer, createGitAnalyzer, analyzeGitHistory, findBugIntroducingCommit } from './core/git-analyzer.js';
export type {
  CommitInfo,
  BlameInfo,
  GitFileChange,
  GitDiffHunk,
  GitDiffLine,
  SuspiciousCommitAnalysis,
  SuspicionReason,
  RelevantChange,
  GitAnalysisResult,
  GitAnalyzerConfig,
} from './core/git-analyzer.js';

// Dependency Graph Builder
export {
  DefaultModuleResolver,
  DependencyGraphBuilder,
  createDependencyGraphBuilder,
  createModuleResolver,
  buildDependencyGraph,
  analyzeGraph,
} from './core/dependency-graph.js';
export type {
  ModuleType,
  ImportType,
  ExportType,
  ModuleImport,
  ImportedName as DependencyImportedName,
  ModuleExport,
  DependencyNode,
  DependencyEdge,
  CircularDependency,
  UnusedExport,
  MissingImport,
  DependencyGraph,
  DependencyGraphStats,
  DependencyGraphConfig,
  ModuleResolver,
} from './core/dependency-graph.js';

// Evidence Collector
export {
  EvidenceCollector,
  createEvidenceCollector,
  collectEvidence,
  collectBatchEvidence,
} from './core/evidence-collector.js';
export type {
  EvidenceType,
  EvidenceDirection,
  EvidenceSource,
  DetailedEvidence,
  CodeStructure as EvidenceCodeStructure,
  FunctionDefinition,
  ParameterDefinition as EvidenceParameterDefinition,
  VariableDeclaration,
  ClassDefinition as EvidenceClassDefinition,
  ImportStatement as EvidenceImportStatement,
  ExportStatement as EvidenceExportStatement,
  ControlFlowStructure,
  CoverageData,
  EvidenceCollectionResult,
  BatchEvidenceResult,
  EvidenceCollectorConfig,
  EvidenceContext,
  GitHistoryData,
} from './core/evidence-collector.js';

// Fix Ranker
export {
  FixRanker,
  createFixRanker,
  rankFixes,
  createFixCandidate,
  buildNGramModel,
} from './core/fix-ranker.js';
export type {
  RankingStrategy,
  RankingFactor,
  FixCandidate,
  FactorScore,
  EntropyScore,
  RankedFix,
  RankingResult,
  FixTestResult,
  HistoricalFix,
  FixRankerConfig,
  NGramModel,
  RankingContext,
} from './core/fix-ranker.js';

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
  // Cascade Layer Analyzer
  CascadeLayerAnalyzer,
  createCascadeLayerAnalyzer,
  analyzeLayerConflicts,
  mapLayerHierarchy,
  // Specificity utilities
  calculateSpecificity,
  compareSpecificity,
  specificityToString,
  specificityToNumber,
  detectSpecificityConflicts,
  parseImportant,
  // Framework Conflict Detector
  FrameworkConflictDetector,
  createFrameworkConflictDetector,
  detectFrameworkConflicts,
  // Tailwind Validator
  TailwindValidator,
  SimpleTailwindValidator,
  createTailwindValidator,
  // Content Path Analyzer
  ContentPathAnalyzer,
  // Dynamic Class Detector
  DynamicClassDetector,
} from './modules/css-module.js';
export type {
  // Cascade Layer types
  CascadeLayer,
  LayerSource,
  LayerRule,
  LayerConflict,
  LayerConflictReason,
  LayerAnalysisResult,
  LayerHierarchyNode,
  LayerDiagnostic,
  LayerAnalysisStats,
  LayerAnalyzerConfig,
  // Specificity types
  Specificity,
  CSSRule,
  SpecificityConflict,
  // Framework Conflict types
  CSSFramework,
  ConflictCategory,
  ConflictSeverity,
  FrameworkConflict,
  FrameworkConflictResult,
  FrameworkConflictDetectorConfig,
  // Tailwind Validator types
  TailwindValidatorConfig,
  TailwindBatchValidationResult,
  InvalidClass,
  // Content Path Analyzer types
  ContentPathResult,
  ContentAnalysisResult,
  UnreachableFile,
  ContentIssue,
  // Dynamic Class Detector types
  DynamicClassType,
  DynamicClassPattern,
  DynamicClassScanResult,
  SafelistEntry,
} from './modules/css-module.js';
export {
  HTMLModule,
  createHTMLModule,
  HTMLValidator,
  createHTMLValidator,
  validateHTML,
  RAW_TEXT_ELEMENTS,
} from './modules/html-module.js';
export type {
  ElementCategory,
  ElementDefinition,
  ParsedElement,
  HTMLValidationError,
  HTMLValidationResult,
  HTMLValidatorConfig,
} from './modules/html-module.js';

// Patterns Module
export {
  loadPatterns,
  loadPatternById,
  validatePattern,
  validatePatternFile,
  createPatternCollection,
  getAvailableCategories,
  getAvailableSeverities,
  getSupportedLanguages,
  PatternMatcher,
  createPatternMatcher,
  matchPatterns,
  type LoadPatternsOptions,
  type LoadPatternsResult,
  type PatternMatcherConfig,
  type MatchContext,
  type ExtendedPatternMatch,
  type MatchResult,
} from './patterns/index.js';
export type {
  BugPattern,
  PatternCollection,
  PatternMatch,
  PatternValidationResult,
  PatternSeverity,
  PatternCategory,
  FixType as PatternFixType,
  PlaceholderSource,
  ASTPattern,
  ASTContext,
  FixTemplate as PatternFixTemplate,
  PlaceholderDefinition,
  PatternExample,
  PatternDocumentation,
  PatternConditions,
  PatternMetadata,
} from './patterns/index.js';
