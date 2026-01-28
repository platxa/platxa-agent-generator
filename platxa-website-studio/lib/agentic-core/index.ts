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
