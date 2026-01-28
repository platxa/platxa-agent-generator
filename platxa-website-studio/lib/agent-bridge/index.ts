/**
 * Agent Bridge
 *
 * Integration layer connecting platxa-website-studio, platxa-frontend-agent,
 * and platxa-editor-sync into a unified AI generation pipeline.
 */

// Types
export type {
  OklchColor,
  OdooColorPalette,
  BrandTokenContext,
  AgentPhase,
  AgentStatus,
  DesignAnalysis,
  PreGenerationResult,
  AccessibilityIssue,
  AccessibilityReport,
  QualityReport,
  PostGenerationResult,
  AgentPipelineResult,
  FileWriteStatus,
  WriteResult,
  AgentPipelineConfig,
  OdooSectionType,
  PageSectionResult,
  PageGenerationResult,
  DesignTokenConstraints,
  SnippetGenerationResult,
  StyleChange,
  TokenValidationIssue,
  StyleModificationResult,
} from "./types";

export { DEFAULT_PIPELINE_CONFIG, SECTION_SNIPPET_IDS } from "./types";

// Color mapper
export {
  hexToOklch,
  oklchToHex,
  mapOdooPaletteToBrandTokens,
  generateLightnessScale,
  meetsContrastAA,
} from "./color-mapper";

// Pre-generation hook
export { runPreGeneration } from "./pre-generation";
export type { PreGenerationInput } from "./pre-generation";

// Post-generation hook
export { runPostGeneration } from "./post-generation";
export type { PostGenerationInput } from "./post-generation";

// Brand token injector
export { injectBrandTokens } from "./brand-token-injector";

// SCSS transformer
export {
  generateOdooColorVariables,
  generateBootstrapOverrides,
  transformToOdooScss,
} from "./scss-transformer";
export type { OdooScssOutput } from "./scss-transformer";

// Sidecar writer (HTTP)
export { writeThroughSidecar } from "./sidecar-writer";
export type { SidecarWriteOptions } from "./sidecar-writer";

// WebSocket file writer (real-time Yjs channel)
export { writeThroughWebSocket } from "./ws-file-writer";
export type { WsFileWriterOptions } from "./ws-file-writer";

// Activity listener
export { subscribeToActivity } from "./activity-listener";
export type {
  ActivityEventType,
  ActivityEvent,
  ActivityListenerOptions,
} from "./activity-listener";

// Project Config Bridge
export {
  deriveAgentContext,
  subscribeProjectConfigBridge,
} from "./project-config-bridge";
export type {
  AgentProjectContext,
  ProjectContextChangeHandler,
} from "./project-config-bridge";

// AI Awareness Protocol
export { AiAwarenessManager } from "./ai-awareness";
export type {
  AiEditingPhase,
  AiAwarenessState,
  AiAwarenessConfig,
} from "./ai-awareness";

// Pipeline
export { AgentPipeline } from "./pipeline";

// Agent Bridge (Frontend Agent integration)
export { AgentBridge } from "./agent-bridge";
export type {
  AgentBridgeConfig,
  AgentBridgeInput,
  AgentBridgeResult,
} from "./agent-bridge";

// Evaluator-Optimizer feedback loop
export {
  evaluate,
  runFeedbackLoop,
  DEFAULT_QUALITY_GATE,
} from "./evaluator-optimizer";
export type {
  QualityGate,
  EvaluationResult,
  FeedbackIteration,
  FeedbackLoopResult,
  EvaluatorFn,
  OptimizerFn,
  FeedbackLoopOptions,
} from "./evaluator-optimizer";

// Orchestrator-Workers pattern
export {
  decomposePage,
  runWorkers,
  orchestratePage,
} from "./orchestrator-workers";
export type {
  SectionTask,
  TaskStatus,
  WorkerResult,
  OrchestrationResult,
  SectionWorkerFn,
  OrchestratorOptions,
} from "./orchestrator-workers";

// Design Analyzer
export { analyzeDesignIntent } from "./design-analyzer";
export type {
  ColorIntent,
  LayoutIntent,
  MoodIntent,
  TypographyIntent,
  SpacingIntent,
  DesignContext,
} from "./design-analyzer";

// SSE Stream
export {
  resetEventCounter,
  createSSEEvent,
  formatSSE,
  parseSSE,
  createSSEEmitter,
  createSSEConsumer,
} from "./sse-stream";
export type {
  SSEEventType,
  SSEEvent,
  ProgressData,
  TokenData,
  SectionCompleteData,
  ErrorData,
  DoneData,
  SSEWriter,
  SSEHandlers,
} from "./sse-stream";

// Scaffolding Wizard
export {
  detectIndustry,
  extractBusinessName,
  extractFeatures,
  toModuleName,
  scaffoldProject,
} from "./scaffolding-wizard";
export type {
  ExtractedBrand,
  ScaffoldedPage,
  ScaffoldedProject,
  ProjectFeature,
} from "./scaffolding-wizard";

// Odoo XML-RPC Deploy
export {
  authenticate,
  callOdoo,
  deployToOdoo,
} from "./odoo-xmlrpc-deploy";
export type {
  OdooConnection,
  DeployStepStatus,
  DeployStep,
  DeployResult,
  XmlRpcCall,
  FileUploader,
  DeployOptions,
} from "./odoo-xmlrpc-deploy";

// Odoo Version Compatibility
export {
  SUPPORTED_VERSIONS,
  adaptManifest,
  adaptTemplate,
  adaptScss,
  adaptForVersion,
  adaptForAllVersions,
} from "./odoo-compat";
export type {
  OdooVersion,
  VersionAdaptation,
  ManifestAdaptation,
  TemplateAdaptation,
  ScssAdaptation,
  VersionOutput,
  ThemeDefinition,
} from "./odoo-compat";

// Odoo Docker Tester
export {
  DEFAULT_DOCKER_CONFIG,
  generateDockerCommands,
  runDockerThemeTest,
} from "./odoo-docker-tester";
export type {
  OdooDockerConfig,
  TestStep,
  RenderCheck,
  DockerTestResult,
  CommandExecutor,
  HttpFetcher,
  DockerTestOptions,
} from "./odoo-docker-tester";

// Marketplace Metadata
export { generateMarketplaceMetadata } from "./marketplace-metadata";
export type {
  IconSpec,
  ScreenshotSpec,
  MarketplaceCategory,
  MarketplaceMetadata,
  MetadataInput,
} from "./marketplace-metadata";

// Odoo Module Packager
export { packageOdooModule } from "./odoo-packager";
export type {
  PackagerInput,
  PackagedFile,
  PackagerResult,
} from "./odoo-packager";

// Self-Correction
export {
  extractCorrections,
  formatCorrectionsForPrompt,
  runSelfCorrection,
} from "./self-correction";
export type {
  CorrectionInstruction,
  RegenerationInput,
  RegenerateFn,
  CorrectionAttempt,
  SelfCorrectionResult,
  SelfCorrectionOptions,
} from "./self-correction";

// Clarifying Questions
export {
  analyzeAmbiguity,
  needsClarification,
  getClarifyingQuestions,
} from "./clarifying-questions";
export type {
  AmbiguityDimension,
  ClarifyingQuestion,
  AmbiguityAnalysis,
} from "./clarifying-questions";

// Agent Cycle (Plan→Search→Read→Edit→Test)
export {
  CYCLE_PHASES,
  createCycleContext,
  isComplexRequest,
  determinePhasesToSkip,
  runAgentCycle,
} from "./agent-cycle";
export type {
  CyclePhase,
  PhaseStatus,
  PhaseResult,
  PlanOutput,
  SearchOutput,
  ReadOutput,
  EditOutput,
  TestOutput,
  PhaseHandler,
  AgentCycleConfig,
  CycleContext,
  AgentCycleResult,
} from "./agent-cycle";

// RAG Pipeline
export {
  tokenize,
  chunkFile,
  indexProject,
  queryIndex,
  createRAGPipeline,
} from "./rag-pipeline";
export type {
  CodeChunk,
  RetrievalResult,
  RAGQueryResult,
  IndexOptions,
} from "./rag-pipeline";

// Snapshot Timeline
export {
  resetSnapshotCounter,
  createTimeline,
  addSnapshot,
  restoreSnapshot,
  restoreById,
  getCurrentSnapshot,
  canUndo,
  canRedo,
  undo,
  redo,
  diffSnapshots,
  getTimelineSummary,
} from "./snapshot-timeline";
export type {
  Snapshot,
  Timeline,
  RestoreResult,
  SnapshotDiff,
} from "./snapshot-timeline";

// Section Reorder
export {
  normalizeSections,
  moveSection,
  getDragFeedback,
  swapSections,
  extractQWebSections,
  reorderQWebTemplate,
} from "./section-reorder";
export type {
  PageSection,
  DragResult,
  DragFeedback,
  QWebSectionRef,
} from "./section-reorder";

// Responsive Validator
export { validateResponsive, DEFAULT_VIEWPORTS } from "./responsive-validator";
export type {
  Viewport,
  ResponsiveRule,
  ResponsiveSeverity,
  ResponsiveIssue,
  ResponsiveResult,
} from "./responsive-validator";

// Keyboard Navigation Validator
export { validateKeyboardNav } from "./keyboard-nav-validator";
export type {
  KbNavRule,
  KbNavSeverity,
  KbNavIssue,
  KbNavResult,
} from "./keyboard-nav-validator";

// A11y Label Checker
export { checkA11yLabels } from "./a11y-label-checker";
export type {
  A11yIssueType,
  A11yIssue,
  A11yLabelResult,
} from "./a11y-label-checker";

// CSS Specificity Analyzer
export {
  calculateSpecificity,
  compareSpecificity,
  formatSpecificity,
  maxNestingDepth,
  analyzeSpecificity,
  DEFAULT_THRESHOLDS,
} from "./css-specificity";
export type {
  Specificity,
  SpecificityIssue,
  SpecificityResult,
  SpecificityThresholds,
} from "./css-specificity";

// Semantic Validator
export { validateSemantics } from "./semantic-validator";
export type {
  SemanticSeverity,
  SemanticIssue,
  SemanticValidationResult,
} from "./semantic-validator";

// Color Harmony
export {
  hexToHsl,
  hslToHex,
  validateHarmony,
  generateHarmoniousPalette,
} from "./color-harmony";
export type {
  HarmonyType,
  HslColor,
  HarmonyIssue,
  HarmonyResult,
} from "./color-harmony";

// Font Validator
export {
  validateFont,
  validateFontPair,
  getAvailableFonts,
  getFontsByCategory,
} from "./font-validator";
export type {
  FontCategory,
  ValidatedFont,
  FontValidationResult,
  FontFetcher,
} from "./font-validator";

// Error Pipeline
export {
  classifyError,
  formatForChat,
  createErrorPipeline,
} from "./error-pipeline";
export type {
  ErrorCategory,
  ErrorSeverity,
  ErrorSuggestion,
  PipelineError,
  RawAgentError,
  ErrorHandler,
} from "./error-pipeline";

// Undo/Redo Stack
export {
  resetOperationCounter,
  createStack,
  pushOperation,
  undoOperation,
  redoOperation,
  canUndoStack,
  canRedoStack,
  clearStack,
  stackSize,
  peekUndo,
  peekRedo,
  matchesShortcut,
  getShortcutAction,
  undoGroup,
  redoGroup,
  DEFAULT_MAX_DEPTH,
  UNDO_SHORTCUT,
  REDO_SHORTCUT,
} from "./undo-redo-stack";
export type {
  EditOperationType,
  EditOperation,
  UndoRedoStack,
  UndoRedoResult,
  KeyboardShortcut,
} from "./undo-redo-stack";

// AI Editing Indicators
export {
  DEFAULT_CLASSES,
  PULSE_KEYFRAMES,
  COMPLETE_KEYFRAMES,
  ERROR_KEYFRAMES,
  generateIndicatorCSS,
  createIndicatorManager,
  markEditing,
  markCompleted,
  markError,
  markIdle,
  removeIndicator,
  resetAll,
  clearAll,
  getIndicator,
  getIndicatorClass,
  getEditingSections,
  getCompletedSections,
  getErrorSections,
  getIndicatorSummary,
} from "./ai-editing-indicators";
export type {
  IndicatorState,
  SectionIndicator,
  IndicatorClasses,
  IndicatorManagerState,
  KeyframesDefinition,
} from "./ai-editing-indicators";

// Live Font Preview
export {
  buildGoogleFontsUrl,
  buildMultiFontUrl,
  buildLinkTag,
  createFontPreviewState,
  applyFontToken,
  markFontLoaded,
  markFontError,
  getLoadingFonts,
  getLoadedFonts,
  getCssOverrideString,
  getTrackedFamilies,
  isFontLoaded,
} from "./live-font-preview";
export type {
  FontToken,
  FontLoadStatus,
  FontLoadEntry,
  FontPreviewState,
  FontChangeResult,
} from "./live-font-preview";

// Color Swatch Panel
export {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  getWcagLevel,
  formatRatio,
  evaluatePair,
  generateSwatchPanel,
} from "./color-swatch-panel";
export type {
  WcagLevel,
  ColorSwatch,
  ContrastPair,
  SwatchPanelData,
} from "./color-swatch-panel";

// Preference Memory
export {
  resetEntryCounter,
  createMemory,
  recordPreference,
  recordRejection,
  recordFavorite,
  getPreference,
  getPreferencesByCategory,
  wasRejected,
  getRejections,
  getTopFavorites,
  getStrongPreferences,
  serializeMemory,
  deserializeMemory,
  mergeMemories,
} from "./preference-memory";
export type {
  PreferenceCategory,
  PreferenceEntry,
  RejectedOption,
  FavoritePattern,
  PreferenceMemory,
  SerializedMemory,
} from "./preference-memory";

// Parallel Generator
export {
  sortByPriority,
  runParallel,
  createTasks,
  DEFAULT_PARALLEL_CONFIG,
} from "./parallel-generator";
export type {
  GenerationTask,
  TaskExecutionStatus,
  TaskResult,
  ProgressEvent,
  ParallelConfig,
  ParallelResult,
  SectionGeneratorFn,
  ProgressCallback,
} from "./parallel-generator";

// Task Router
export {
  LAYOUT_WORKER,
  CONTENT_WORKER,
  STYLE_WORKER,
  INTERACTION_WORKER,
  DEFAULT_WORKERS,
  DEFAULT_ROUTER_CONFIG,
  scoreWorker,
  routeTask,
  routeBatch,
} from "./task-router";
export type {
  WorkerType,
  RoutableTask,
  RoutingDecision,
  WorkerDefinition,
  RouterConfig,
  BatchRoutingResult,
} from "./task-router";

// Progress Streaming
export {
  DEFAULT_PHASES,
  createProgressState,
  advancePhase,
  failCurrentPhase,
  skipPhase,
  completeAll,
  computeProgress,
  estimateRemainingMs,
  getProgressEvent,
  getPhaseSummary,
} from "./progress-streaming";
export type {
  PhaseName as StreamPhaseName,
  PhaseStatus as StreamPhaseStatus,
  Phase as StreamPhase,
  ProgressState,
  ProgressStreamEvent,
} from "./progress-streaming";

// Rollback Recovery
export {
  resetStepCounter,
  assessSeverity,
  selectStrategy,
  selectFallback,
  generateSteps,
  createRecoveryPlan,
  createRollbackState,
  setLastGoodState,
  recordAttempt,
  getFailedAttemptCount,
  getLastSuccessfulRecovery,
} from "./rollback-recovery";
export type {
  RecoveryStrategy,
  FailureSeverity,
  FailureContext,
  RecoveryPlan,
  RecoveryStep,
  RecoveryResult,
  RecoveryExecutor,
  RollbackState,
} from "./rollback-recovery";

// Context Window Manager
export {
  estimateTokens,
  createBudget,
  computeScore,
  sortByRelevance,
  assembleContext,
  createContextItem,
  createContextWindow,
  addItem,
  removeItem,
  updateRelevance,
  assembleFromState,
  getItemsByCategory,
  getTotalTokens,
  isOverBudget,
} from "./context-window";
export type {
  ContextPriority,
  ContextItem,
  ContextBudget,
  ContextAssembly,
  ContextWindowState,
} from "./context-window";

// Rate Limiter
export {
  DEFAULT_RATE_CONFIG,
  createRateLimitState,
  getCallsInWindow,
  checkRateLimit,
  recordApiCall,
  getTotalTokens as getRateLimitTotalTokens,
  getCostBreakdown,
  getBudgetUtilization,
  getRemainingBudget,
  getAlerts,
  resetRateWindows,
} from "./rate-limiter";
export type {
  RateLimitConfig,
  ApiCall,
  BudgetAlert,
  CostBreakdown,
  RateLimitState,
  RateLimitDecision,
} from "./rate-limiter";

// Telemetry
export {
  resetTelemetryCounter,
  createTelemetryState,
  recordEvent,
  recordGeneration,
  recordSatisfaction,
  computeAnalytics,
  getMetricsByRange,
  getEventsByType,
  serializeTelemetry,
  deserializeTelemetry,
} from "./telemetry";
export type {
  TelemetryEvent,
  TelemetryEventType,
  GenerationMetrics,
  AnalyticsSummary,
  TelemetryState,
} from "./telemetry";

// Dev Mode
export {
  WEBSITE_STUDIO,
  EDITOR_SYNC,
  FRONTEND_AGENT,
  DEFAULT_SYSTEMS,
  DEFAULT_DEV_CONFIG,
  classifyReload,
  createReloadAction,
  getCrossDependencies,
  expandReloads,
  createDevState,
  startDevMode,
  markRunning,
  recordChange,
  completeReload,
  stopDevMode,
  getDevSummary,
  getErrorSystems,
  allRunning,
} from "./dev-mode";
export type {
  DevSystem,
  SystemStatus,
  SystemState,
  FileChangeEvent,
  ReloadAction,
  DevModeState,
  DevModeConfig,
} from "./dev-mode";

// Platxa CLI
export {
  GENERATE_CMD,
  PREVIEW_CMD,
  DEPLOY_CMD,
  TEST_CMD,
  EXPORT_CMD,
  ALL_COMMANDS,
  parseArgs,
  formatCommandHelp,
  formatGlobalHelp,
  createCli,
  registerHandler,
  runCli,
} from "./platxa-cli";
export type {
  CliCommand,
  ArgDef,
  OptionDef,
  ParsedArgs,
  CommandResult,
  CommandHandler,
  CliConfig,
} from "./platxa-cli";

// App Store Validator
export {
  validateLicense,
  validateVersion,
  validateMetadata,
  validateDependencies,
  validateIcon,
  validateScreenshots,
  validateDescription,
  validatePricing,
  validateSubmission,
  VALID_LICENSES,
  VALID_CATEGORIES,
} from "./appstore-validator";
export type {
  ValidationSeverity,
  ValidationIssue,
  ManifestData,
  SubmissionAssets,
  ValidationResult,
} from "./appstore-validator";

// Theme Config Wizard
export {
  toPythonClass,
  isValidHex,
  validateConfig,
  generateWizard,
  DEFAULT_PALETTES,
  DEFAULT_FONTS,
  DEFAULT_LAYOUTS,
} from "./theme-config-wizard";
export type {
  ColorPalette,
  FontOption,
  LayoutOption,
  WizardConfig,
  WizardOutput,
  GeneratedFile,
} from "./theme-config-wizard";

// Preview Server
export {
  evaluateExpr,
  processAttfValue,
  renderQWeb,
  compileScss,
  createRegistry,
  registerTemplate,
  renderPreview,
} from "./preview-server";
export type {
  QWebContext,
  RenderResult,
  RenderError,
  TemplateRegistry,
  PreviewConfig,
} from "./preview-server";

// Asset Optimizer
export {
  minifyScss,
  optimizeImage,
  subsetFont,
  optimizeAssets,
  DEFAULT_OPTIMIZER_CONFIG,
} from "./asset-optimizer";
export type {
  OptimizationStats,
  ScssMinifyResult,
  ImageOptimizeResult,
  FontSubsetResult,
  AssetOptimizationResult,
  OptimizerConfig,
  AssetInput,
} from "./asset-optimizer";

// Migration Generator
export {
  getVersionHops,
  getBreakingChanges,
  generateScript,
  generateMigration,
} from "./migration-generator";
export type {
  MigrationStep,
  MigrationScript,
  MigrationResult,
  BreakingChange,
} from "./migration-generator";

// I18n
export {
  DEFAULT_I18N_CONFIG,
  createI18nState,
  wrapWithTranslationMarker,
  wrapPythonStrings,
  wrapXmlStrings,
  extractFromPython,
  extractFromXml,
  generatePoFile,
  serializePoFile,
  parsePoFile,
  processI18n,
} from "./i18n";
export type {
  TranslationEntry,
  PoFile,
  I18nConfig,
  I18nState,
  ExtractionResult,
  I18nResult,
} from "./i18n";

// Design Tokens (Tier 2)
export * from "../design-tokens";
