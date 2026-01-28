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

// Design Tokens (Tier 2)
export * from "../design-tokens";
