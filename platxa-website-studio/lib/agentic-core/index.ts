/**
 * Agentic Core - Autonomous execution engine for Lovable-parity
 *
 * @module agentic-core
 */

export {
  AgentEngine,
  createAgentEngine,
  type AgentStatus,
  type AgentActionType,
  type AgentPlanStep,
  type AgentPlan,
  type AgentError,
  type FileModification,
  type AgentContext,
  type ValidationResult,
  type AgentState,
  type AgentEngineConfig,
  type AgentResult,
  type AgentResultStatus,
  type AgentEvents,
  type ProgressEvent,
  type ToolExecutor,
  type LLMProvider,
} from './agent-engine';

export {
  PlanGenerator,
  createPlanGenerator,
  type LLMPlanResponse,
  type LLMFixResponse,
  type PlanGeneratorOptions,
  type PlanPromptTemplates,
} from './plan-generator';

export {
  AgentToolExecutor,
  createToolExecutor,
  createToolExecutorWithTools,
  type ToolResult,
  type ToolFunction,
  type ToolParams,
  type ToolRegistration,
  type ToolExecutorConfig,
  type MemoizationStats,
} from './tool-executor';

export {
  ValidationEngine,
  createValidationEngine,
  type ValidatorResult,
  type ValidationError,
  type ValidationWarning,
  type ValidatorFunction,
  type ValidatorOptions,
  type ValidationEngineConfig,
  type ValidatorType,
} from './validation-engine';

export {
  ErrorInjector,
  createErrorInjector,
  type InjectedError,
  type ErrorContext,
  type ErrorInjectorOptions,
} from './error-injector';

export {
  Replanner,
  createReplanner,
  type ReplannerConfig,
  type ReplanResult,
  type FixStrategy,
} from './replanner';

export {
  ModeRouter,
  createModeRouter,
  classifyIntent,
  type IntentMode,
  type ConfidenceLevel,
  type ClassificationResult,
  type ModeRouterConfig,
  type LLMClassifier,
} from './mode-router';

export {
  ContextBuilder,
  createContextBuilder,
  buildContextFromMessage,
  buildPlanContext,
  buildAgentContext,
  PLAN_MODE_DISABLED_TOOLS,
  PLAN_MODE_TOOLS,
  AGENT_MODE_TOOLS,
  ALL_TOOLS,
  type ContextBuilderOptions,
  type ContextBuildResult,
} from './context-builder';

export {
  PlanHandoff,
  createPlanHandoff,
  handoffPlanToAgent,
  handoffWithOptions,
  type PlanOption,
  type PlanApproval,
  type PlanningContext,
  type HandoffResult,
  type HandoffOptions,
  type ExecutionBundle,
} from './plan-handoff';

export {
  ContextManager,
  createContextManager,
  createContextManagerFrom,
  type KnowledgeEntry,
  type IterationSnapshot,
  type ContextStats,
  type ContextManagerOptions,
} from './context-manager';

export {
  ContextPruner,
  createContextPruner,
  createPrunerForModel,
  MODEL_TOKEN_LIMITS,
  type TokenEstimate,
  type PruneStats,
  type ContextPrunerConfig,
  type PrunableItem,
} from './context-pruner';

export {
  CrossRequestCache,
  getCrossRequestCache,
  withCrossRequestCache,
  type CacheEntryType,
  type FileMetadata,
  type CacheEntry,
  type CacheStats,
  type CrossRequestCacheConfig,
  type FileChangeEvent,
  type CacheableManager,
  type CachedManager,
} from './cross-request-cache';

export {
  PlanEngine,
  createPlanEngine,
  type PlanQuery,
  type Clarification,
  type ExplorationResult,
  type PlanEngineState,
  type PlanEngineConfig,
  type PlanEngineEvents,
} from './plan-engine';

export {
  RequestAnalyzer,
  createRequestAnalyzer,
  analyzeRequest,
  type IssueSeverity,
  type IssueType,
  type RequestIssue,
  type VagueTermPattern,
  type RequiredDetail,
  type ConflictPattern,
  type AnalysisResult,
  type RequestAnalyzerConfig,
} from './request-analyzer';

export {
  ClarifyingQuestionGenerator,
  createQuestionGenerator,
  generateQuestions,
  type ClarifyingQuestion,
  type QuestionGenerationResult,
  type QuestionTemplate,
  type QuestionGeneratorConfig,
} from './question-generator';

export {
  OptionGenerator,
  createOptionGenerator,
  generateOptions,
  type EffortLevel,
  type ApproachCategory,
  type OptionPro,
  type OptionCon,
  type EffortEstimate,
  type AffectedFile,
  type DesignOption,
  type OptionGenerationResult,
  type OptionTemplate,
  type OptionGeneratorConfig,
  type GenerationContext,
} from './option-generator';

export {
  PlanPreviewGenerator,
  createPlanPreviewGenerator,
  generatePlanPreview,
  generateOptionPreview,
  type StepPreview,
  type FilePreview,
  type DurationEstimate,
  type PlanPreview,
  type PlanPreviewConfig,
  type PreviewFormat,
} from './plan-preview';

export {
  ApprovalWorkflow,
  createApprovalWorkflow,
  startApprovalWorkflow,
  type ApprovalAction,
  type WorkflowState,
  type ActionButton,
  type ModificationRequest,
  type RefinementSession,
  type WorkflowResult,
  type WorkflowEvents,
  type ApprovalWorkflowConfig,
} from './approval-workflow';

export {
  CheckpointManager,
  createCheckpointManager,
  createPreExecutionCheckpoint,
  type CheckpointType,
  type Checkpoint,
  type CheckpointResult,
  type RollbackResult,
  type YjsDocument,
  type YjsProvider,
  type CheckpointManagerConfig,
} from './checkpoint-manager';
