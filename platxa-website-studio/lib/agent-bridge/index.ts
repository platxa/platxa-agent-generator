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

// Design Tokens (Tier 2)
export * from "../design-tokens";
