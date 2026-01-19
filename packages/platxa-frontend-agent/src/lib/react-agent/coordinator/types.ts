/**
 * Multi-Agent Coordinator - Type Definitions
 *
 * Implements the orchestrator-workers pattern where a central coordinator
 * dispatches tasks to specialized sub-agents and aggregates their results.
 *
 * Based on research findings:
 * - Multi-agent systems are the 2026 standard, replacing monolithic agents
 * - Specialized agents with coordinator/supervisor enable complex workflows
 * - Each agent operates independently with all coordination through supervisor
 */

import type { AgentInput, AgentOutput } from "../types"

/**
 * Status of a sub-agent in the system
 */
export type SubAgentStatus =
  | "idle"
  | "busy"
  | "completed"
  | "failed"
  | "unavailable"

/**
 * Task priority levels
 */
export type TaskPriority = "critical" | "high" | "medium" | "low"

/**
 * Strategy for distributing tasks to agents
 */
export type DistributionStrategy =
  | "round-robin"
  | "least-busy"
  | "capability-match"
  | "priority-based"
  | "random"

/**
 * Strategy for aggregating results from multiple agents
 */
export type AggregationStrategy =
  | "merge"
  | "vote"
  | "first-success"
  | "all-required"
  | "best-score"
  | "custom"

/**
 * Definition of a sub-agent's capabilities
 */
export interface SubAgentCapabilities {
  /** Unique identifier for the capability */
  id: string
  /** Human-readable name */
  name: string
  /** Description of what this capability does */
  description: string
  /** Tags for matching tasks */
  tags: string[]
  /** Priority weight (higher = preferred) */
  weight?: number
}

/**
 * Configuration for a sub-agent
 */
export interface SubAgentConfig {
  /** Unique identifier for this agent */
  id: string
  /** Human-readable name */
  name: string
  /** Agent's capabilities */
  capabilities: SubAgentCapabilities[]
  /** Maximum concurrent tasks this agent can handle */
  maxConcurrency: number
  /** Timeout for individual tasks in milliseconds */
  taskTimeoutMs: number
  /** Whether this agent is enabled */
  enabled: boolean
  /** Metadata for custom routing logic */
  metadata?: Record<string, unknown>
}

/**
 * Runtime state of a sub-agent
 */
export interface SubAgentState {
  /** Agent configuration */
  config: SubAgentConfig
  /** Current status */
  status: SubAgentStatus
  /** Number of active tasks */
  activeTasks: number
  /** Total tasks completed */
  completedTasks: number
  /** Total tasks failed */
  failedTasks: number
  /** Last activity timestamp */
  lastActivity: number
  /** Current task IDs being processed */
  currentTaskIds: string[]
}

/**
 * A task to be distributed to sub-agents
 */
export interface CoordinatorTask {
  /** Unique task identifier */
  id: string
  /** Task type for routing */
  type: string
  /** Task priority */
  priority: TaskPriority
  /** Task payload */
  payload: AgentInput
  /** Required capabilities (agent must have at least one) */
  requiredCapabilities?: string[]
  /** Preferred agent ID (if any) */
  preferredAgentId?: string
  /** Maximum retries on failure */
  maxRetries: number
  /** Current retry count */
  retryCount: number
  /** Task creation timestamp */
  createdAt: number
  /** Task deadline (optional) */
  deadline?: number
  /** Parent task ID (for subtasks) */
  parentTaskId?: string
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Result from a sub-agent task execution
 */
export interface SubAgentResult {
  /** Task ID */
  taskId: string
  /** Agent ID that processed the task */
  agentId: string
  /** Whether execution was successful */
  success: boolean
  /** Agent output */
  output: AgentOutput
  /** Execution time in milliseconds */
  executionTimeMs: number
  /** Error message if failed */
  error?: string
  /** Quality score (0-1) if applicable */
  score?: number
  /** Result metadata */
  metadata?: Record<string, unknown>
}

/**
 * Aggregated result from multiple sub-agents
 */
export interface AggregatedResult {
  /** Overall success status */
  success: boolean
  /** Aggregation strategy used */
  strategy: AggregationStrategy
  /** Individual results from each agent */
  results: SubAgentResult[]
  /** Merged/aggregated output */
  aggregatedOutput: unknown
  /** Summary of the aggregation */
  summary: string
  /** Total execution time */
  totalExecutionTimeMs: number
  /** Statistics */
  stats: {
    totalTasks: number
    successfulTasks: number
    failedTasks: number
    averageExecutionTimeMs: number
  }
}

/**
 * Configuration for the coordinator
 */
export interface CoordinatorConfig {
  /** Coordinator identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Task distribution strategy */
  distributionStrategy: DistributionStrategy
  /** Result aggregation strategy */
  aggregationStrategy: AggregationStrategy
  /** Maximum concurrent tasks across all agents */
  maxGlobalConcurrency: number
  /** Default task timeout in milliseconds */
  defaultTaskTimeoutMs: number
  /** Maximum retries for failed tasks */
  maxRetries: number
  /** Whether to enable task queuing */
  enableQueuing: boolean
  /** Maximum queue size */
  maxQueueSize: number
  /** Enable verbose logging */
  verbose: boolean
  /** Custom routing function */
  customRouter?: TaskRouter
  /** Custom aggregation function */
  customAggregator?: ResultAggregator
}

/**
 * State of the coordinator
 */
export interface CoordinatorState {
  /** Coordinator status */
  status: "idle" | "running" | "paused" | "stopped"
  /** Registered sub-agents */
  agents: Map<string, SubAgentState>
  /** Pending tasks in queue */
  taskQueue: CoordinatorTask[]
  /** Active tasks being processed */
  activeTasks: Map<string, { task: CoordinatorTask; agentId: string }>
  /** Completed results */
  completedResults: SubAgentResult[]
  /** Start time of current session */
  startTime: number
  /** Total tasks processed */
  totalProcessed: number
}

/**
 * Event types emitted by the coordinator
 */
export type CoordinatorEventType =
  | "task_queued"
  | "task_assigned"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "task_retried"
  | "agent_registered"
  | "agent_unregistered"
  | "agent_status_changed"
  | "aggregation_complete"
  | "coordinator_started"
  | "coordinator_stopped"

/**
 * Event emitted by the coordinator
 */
export interface CoordinatorEvent {
  type: CoordinatorEventType
  timestamp: number
  data: {
    taskId?: string
    agentId?: string
    task?: CoordinatorTask
    result?: SubAgentResult
    aggregatedResult?: AggregatedResult
    previousStatus?: SubAgentStatus
    newStatus?: SubAgentStatus
    error?: string
  }
}

/**
 * Callback for coordinator events
 */
export type CoordinatorEventCallback = (event: CoordinatorEvent) => void

/**
 * Interface for custom task routing logic
 */
export interface TaskRouter {
  /**
   * Selects the best agent for a given task
   * @returns Agent ID or null if no suitable agent found
   */
  route(
    task: CoordinatorTask,
    availableAgents: SubAgentState[]
  ): string | null
}

/**
 * Interface for custom result aggregation logic
 */
export interface ResultAggregator {
  /**
   * Aggregates results from multiple agents
   */
  aggregate(results: SubAgentResult[]): AggregatedResult
}

/**
 * Interface that sub-agents must implement
 */
export interface SubAgent {
  /** Get agent configuration */
  getConfig(): SubAgentConfig
  /** Execute a task */
  execute(task: CoordinatorTask): Promise<AgentOutput>
  /** Check if agent can handle a task */
  canHandle(task: CoordinatorTask): boolean
  /** Get current status */
  getStatus(): SubAgentStatus
  /** Enable the agent */
  enable(): void
  /** Disable the agent */
  disable(): void
}

/**
 * Hooks for extending coordinator behavior
 */
export interface CoordinatorHooks {
  /** Called before routing a task */
  beforeRoute?: (task: CoordinatorTask, agents: SubAgentState[]) => Promise<void>
  /** Called after routing a task */
  afterRoute?: (task: CoordinatorTask, agentId: string | null) => Promise<void>
  /** Called before executing a task */
  beforeExecute?: (task: CoordinatorTask, agentId: string) => Promise<boolean>
  /** Called after task execution */
  afterExecute?: (result: SubAgentResult) => Promise<void>
  /** Called before aggregation */
  beforeAggregate?: (results: SubAgentResult[]) => Promise<void>
  /** Called after aggregation */
  afterAggregate?: (aggregatedResult: AggregatedResult) => Promise<void>
  /** Called on coordinator error */
  onError?: (error: Error, context: { taskId?: string; agentId?: string }) => Promise<void>
}
