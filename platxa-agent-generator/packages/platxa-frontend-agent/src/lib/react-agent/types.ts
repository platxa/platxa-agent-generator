/**
 * ReAct Agent Framework - Type Definitions
 *
 * Implements the ReAct (Reasoning and Acting) pattern where agents
 * alternate between reasoning steps and action steps in a loop.
 *
 * Based on research findings:
 * - ReAct is foundational pattern for most AI agents
 * - Enables iterative problem-solving through reason-act loops
 * - Supports reflection and self-correction
 */

/**
 * Represents a single step in the agent's execution
 */
export type StepType = "reasoning" | "action" | "observation"

/**
 * Status of the agent execution
 */
export type AgentStatus =
  | "idle"
  | "reasoning"
  | "acting"
  | "observing"
  | "completed"
  | "failed"
  | "paused"

/**
 * Result of a reasoning step
 */
export interface ReasoningResult {
  thought: string
  nextAction: string | null
  confidence: number // 0-1 scale
  shouldContinue: boolean
  metadata?: Record<string, unknown>
}

/**
 * Definition of an action that can be executed
 */
export interface ActionDefinition {
  name: string
  description: string
  parameters: Record<string, ParameterDefinition>
  execute: (params: Record<string, unknown>) => Promise<ActionResult>
}

/**
 * Parameter definition for an action
 */
export interface ParameterDefinition {
  type: "string" | "number" | "boolean" | "object" | "array"
  description: string
  required: boolean
  default?: unknown
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  success: boolean
  output: unknown
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Observation from an action result
 */
export interface Observation {
  actionName: string
  result: ActionResult
  timestamp: number
  stepNumber: number
}

/**
 * A single step in the ReAct loop
 */
export interface Step {
  type: StepType
  content: ReasoningResult | ActionResult | Observation
  timestamp: number
  stepNumber: number
}

/**
 * Configuration for the ReAct agent
 */
export interface AgentConfig {
  /** Maximum number of reasoning-action loops */
  maxIterations: number
  /** Timeout per step in milliseconds */
  stepTimeoutMs: number
  /** Minimum confidence to proceed with action */
  minConfidenceThreshold: number
  /** Enable verbose logging */
  verbose: boolean
  /** Enable step-by-step human approval */
  humanInTheLoop: boolean
  /** Custom reasoning prompt template */
  reasoningPromptTemplate?: string
  /** Actions available to this agent */
  actions: ActionDefinition[]
}

/**
 * State of the agent at any point in execution
 */
export interface AgentState {
  status: AgentStatus
  currentStep: number
  steps: Step[]
  context: Record<string, unknown>
  startTime: number
  endTime?: number
  error?: string
}

/**
 * Event emitted during agent execution
 */
export interface AgentEvent {
  type:
    | "step_start"
    | "step_complete"
    | "reasoning"
    | "action"
    | "observation"
    | "complete"
    | "error"
    | "paused"
  step?: Step
  state: AgentState
  timestamp: number
}

/**
 * Callback for agent events
 */
export type AgentEventCallback = (event: AgentEvent) => void

/**
 * Input to start agent execution
 */
export interface AgentInput {
  task: string
  context?: Record<string, unknown>
  constraints?: string[]
}

/**
 * Final output from agent execution
 */
export interface AgentOutput {
  success: boolean
  result: unknown
  reasoning: string
  steps: Step[]
  totalSteps: number
  executionTimeMs: number
  metadata?: Record<string, unknown>
}

/**
 * Interface for implementing custom reasoning logic
 */
export interface ReasoningEngine {
  reason(
    task: string,
    observations: Observation[],
    context: Record<string, unknown>,
    availableActions: ActionDefinition[]
  ): Promise<ReasoningResult>
}

/**
 * Interface for implementing custom action execution
 */
export interface ActionExecutor {
  execute(
    action: ActionDefinition,
    params: Record<string, unknown>
  ): Promise<ActionResult>
}

/**
 * Hook points for extending agent behavior
 */
export interface AgentHooks {
  /** Called before each reasoning step */
  beforeReasoning?: (state: AgentState) => Promise<void>
  /** Called after each reasoning step */
  afterReasoning?: (result: ReasoningResult, state: AgentState) => Promise<void>
  /** Called before each action */
  beforeAction?: (
    action: ActionDefinition,
    params: Record<string, unknown>,
    state: AgentState
  ) => Promise<boolean>
  /** Called after each action */
  afterAction?: (result: ActionResult, state: AgentState) => Promise<void>
  /** Called when agent completes */
  onComplete?: (output: AgentOutput) => Promise<void>
  /** Called when agent encounters an error */
  onError?: (error: Error, state: AgentState) => Promise<void>
}
